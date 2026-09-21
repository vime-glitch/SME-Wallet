const crypto = require("crypto");
const express = require("express");
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

const validateDepositAmount = (value) => {
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
        return {
            valid: false,
            message: "Deposit amount is required."
        };
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return {
            valid: false,
            message: "Deposit amount must be a positive number."
        };
    }

    return {
        valid: true,
        value: numericValue
    };
};

const findOrCreateTransactionType = async (
    client,
    typeName,
    description = "Funds deposited into a user wallet."
) => {
    const result = await client.query(
        "SELECT transaction_type_id, type_name FROM transaction_type WHERE LOWER(type_name) = LOWER($1) LIMIT 1;",
        [typeName]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    const insertResult = await client.query(
        `INSERT INTO transaction_type (type_name, description)
         VALUES ($1, $2)
         ON CONFLICT (type_name) DO NOTHING
         RETURNING transaction_type_id, type_name;`,
        [typeName, description]
    );

    if (insertResult.rows.length > 0) {
        return insertResult.rows[0];
    }

    const fallback = await client.query(
        "SELECT transaction_type_id, type_name FROM transaction_type WHERE LOWER(type_name) = LOWER($1) LIMIT 1;",
        [typeName]
    );

    return fallback.rows[0];
};

const findOrCreateTransactionStatus = async (client, statusName) => {
    const result = await client.query(
        "SELECT transaction_status_id, status_name FROM transaction_status WHERE LOWER(status_name) = LOWER($1) LIMIT 1;",
        [statusName]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    const insertResult = await client.query(
        `INSERT INTO transaction_status (status_name, description)
         VALUES ($1, $2)
         ON CONFLICT (status_name) DO NOTHING
         RETURNING transaction_status_id, status_name;`,
        [statusName, "The transaction has been successfully completed."]
    );

    if (insertResult.rows.length > 0) {
        return insertResult.rows[0];
    }

    const fallback = await client.query(
        "SELECT transaction_status_id, status_name FROM transaction_status WHERE LOWER(status_name) = LOWER($1) LIMIT 1;",
        [statusName]
    );

    return fallback.rows[0];
};

router.post("/transfer", authenticateToken, async (req, res) => {
    const { recipient, amount } = req.body;

    if (amount === undefined || amount === null) {
        return res.status(400).json({
            message: "Transfer amount is required."
        });
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
            message: "Transfer amount must be a positive number."
        });
    }

    if (
        (typeof recipient !== "number" && typeof recipient !== "string") ||
        (typeof recipient === "string" && recipient.trim() === "") ||
        !Number.isInteger(Number(recipient)) ||
        Number(recipient) <= 0
    ) {
        return res.status(400).json({
            message: "A valid SME identifier is required."
        });
    }

    const smeId = Number(recipient);
    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const senderRoleResult = await client.query(
            `SELECT 1
             FROM customer c
             INNER JOIN user_role ur ON ur.user_id = c.user_id
             INNER JOIN role r ON r.role_id = ur.role_id
             WHERE c.user_id = $1
               AND LOWER(r.role_name) = 'customer'
             LIMIT 1;`,
            [req.user.user_id]
        );

        if (senderRoleResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Only users with the Customer role can initiate transfers."
            });
        }

        const recipientResult = await client.query(
            `SELECT
                s.sme_id,
                s.user_id,
                s.business_name
             FROM sme s
             INNER JOIN user_role ur ON ur.user_id = s.user_id
             INNER JOIN role r ON r.role_id = ur.role_id
             WHERE s.sme_id = $1
               AND s.is_active = TRUE
               AND LOWER(r.role_name) = 'sme'
             LIMIT 1;`,
            [smeId]
        );

        if (recipientResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                message: "SME recipient not found."
            });
        }

        const recipientDetails = recipientResult.rows[0];

        if (recipientDetails.user_id === req.user.user_id) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "You cannot transfer money to yourself."
            });
        }

        const walletResult = await client.query(
            `SELECT
                wallet_id,
                user_id,
                balance,
                status
             FROM wallet
             WHERE user_id IN ($1, $2)
             ORDER BY wallet_id
             FOR UPDATE;`,
            [req.user.user_id, recipientDetails.user_id]
        );

        const senderWallet = walletResult.rows.find((wallet) => wallet.user_id === req.user.user_id);
        const recipientWallet = walletResult.rows.find((wallet) => wallet.user_id === recipientDetails.user_id);

        if (!senderWallet) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                message: "Wallet not found for this user."
            });
        }

        if (senderWallet.status !== "active") {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Wallet is not active. Transfer cannot be processed."
            });
        }

        if (!recipientWallet) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                message: "Recipient wallet not found."
            });
        }

        if (recipientWallet.status !== "active") {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Recipient wallet is not active."
            });
        }

        const senderBalance = Number(senderWallet.balance);

        if (!Number.isFinite(senderBalance) || senderBalance < amount) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "Insufficient wallet balance."
            });
        }

        const transferType = await findOrCreateTransactionType(
            client,
            "wallet transfer",
            "Funds transferred from one wallet to another."
        );
        const completedStatus = await findOrCreateTransactionStatus(client, "completed");

        const updatedWalletResult = await client.query(
            `UPDATE wallet
             SET balance = balance - $1
             WHERE wallet_id = $2
               AND balance >= $1
             RETURNING wallet_id, user_id, balance, status;`,
            [amount, senderWallet.wallet_id]
        );

        if (updatedWalletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "Insufficient wallet balance."
            });
        }

        const updatedSenderWallet = updatedWalletResult.rows[0];

        const updatedRecipientWalletResult = await client.query(
            `UPDATE wallet
             SET balance = balance + $1
             WHERE wallet_id = $2
             RETURNING wallet_id, user_id, balance, status;`,
            [amount, recipientWallet.wallet_id]
        );

        if (updatedRecipientWalletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(500).json({
                message: "Transfer could not be completed."
            });
        }

        const referenceNumber = `TRF-${Date.now()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
        const transactionResult = await client.query(
            `INSERT INTO transactions (
                sender_wallet_id,
                receiver_wallet_id,
                user_account_id,
                initiated_by_user_id,
                transaction_type_id,
                transaction_status_id,
                amount,
                transaction_datetime,
                description,
                reference_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
            RETURNING reference_number, amount, transaction_datetime, description;`,
            [
                updatedSenderWallet.wallet_id,
                updatedRecipientWalletResult.rows[0].wallet_id,
                null,
                req.user.user_id,
                transferType.transaction_type_id,
                completedStatus.transaction_status_id,
                amount,
                `Wallet transfer to ${recipientDetails.business_name}.`,
                referenceNumber
            ]
        );

        await client.query("COMMIT");

        const transaction = transactionResult.rows[0];

        return res.status(200).json({
            message: "Transfer successful.",
            transaction_reference: transaction.reference_number,
            transferred_amount: Number(transaction.amount),
            updated_sender_wallet_balance: Number(updatedSenderWallet.balance),
            recipient: {
                sme_id: recipientDetails.sme_id,
                business_name: recipientDetails.business_name
            },
            transaction_status: completedStatus.status_name
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }
        console.error("Transfer error:", error);
        return res.status(500).json({
            message: "Database error while processing transfer."
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

router.get("/", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                wallet_id,
                user_id,
                balance,
                status,
                created_date
            FROM wallet
            WHERE user_id = $1
            LIMIT 1;`,
            [req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Wallet not found for this user."
            });
        }

        const wallet = result.rows[0];

        return res.status(200).json({
            wallet: {
                wallet_id: wallet.wallet_id,
                user_id: wallet.user_id,
                balance: Number(wallet.balance),
                status: wallet.status,
                created_date: wallet.created_date
            }
        });
    } catch (error) {
        console.error("Get wallet error:", error);
        return res.status(500).json({
            message: "Database error while fetching wallet."
        });
    }
});

router.post("/deposit", authenticateToken, async (req, res) => {
    const { amount } = req.body;
    const validatedAmount = validateDepositAmount(amount);

    if (!validatedAmount.valid) {
        return res.status(400).json({
            message: validatedAmount.message
        });
    }

    const cleanAmount = validatedAmount.value;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const walletResult = await client.query(
            `SELECT
                wallet_id,
                user_id,
                balance,
                status
            FROM wallet
            WHERE user_id = $1
            LIMIT 1;`,
            [req.user.user_id]
        );

        if (walletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                message: "Wallet not found for this user."
            });
        }

        const wallet = walletResult.rows[0];

        if (wallet.status !== "active") {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Wallet is not active. Deposit cannot be processed."
            });
        }

        const depositType = await findOrCreateTransactionType(client, "deposit");
        const completedStatus = await findOrCreateTransactionStatus(client, "completed");

        const updatedWalletResult = await client.query(
            `UPDATE wallet
             SET balance = balance + $1
             WHERE wallet_id = $2
             RETURNING wallet_id, user_id, balance, status;`,
            [cleanAmount, wallet.wallet_id]
        );

        const updatedWallet = updatedWalletResult.rows[0];
        const referenceNumber = `DEP-${Date.now()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

        const transactionResult = await client.query(
            `INSERT INTO transactions (
                sender_wallet_id,
                receiver_wallet_id,
                user_account_id,
                initiated_by_user_id,
                transaction_type_id,
                transaction_status_id,
                amount,
                transaction_datetime,
                description,
                reference_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
            RETURNING
                transaction_id,
                reference_number,
                amount,
                transaction_datetime,
                description;`,
            [
                null,
                updatedWallet.wallet_id,
                null,
                req.user.user_id,
                depositType.transaction_type_id,
                completedStatus.transaction_status_id,
                cleanAmount,
                "Deposit funds into wallet.",
                referenceNumber
            ]
        );

        await client.query("COMMIT");

        const transaction = transactionResult.rows[0];

        return res.status(200).json({
            message: "Deposit successful.",
            transaction_reference: transaction.reference_number,
            deposited_amount: Number(transaction.amount),
            updated_wallet_balance: Number(updatedWallet.balance),
            transaction_status: completedStatus.status_name,
            wallet: {
                wallet_id: updatedWallet.wallet_id,
                user_id: updatedWallet.user_id,
                status: updatedWallet.status,
                balance: Number(updatedWallet.balance)
            }
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Deposit error:", error);
        return res.status(500).json({
            message: "Database error while processing deposit."
        });
    } finally {
        client.release();
    }
});

router.post("/withdraw", authenticateToken, async (req, res) => {
    const { amount, account_id: accountId } = req.body;

    if (amount === undefined || amount === null || (typeof amount === "string" && amount.trim() === "")) {
        return res.status(400).json({
            message: "Withdrawal amount is required."
        });
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
            message: "Withdrawal amount must be a positive number."
        });
    }

    if (accountId === undefined || accountId === null || accountId === "") {
        return res.status(400).json({
            message: "Bank account is required."
        });
    }

    if (
        (typeof accountId !== "number" && typeof accountId !== "string") ||
        (typeof accountId === "string" && accountId.trim() === "") ||
        !Number.isInteger(Number(accountId)) ||
        Number(accountId) <= 0
    ) {
        return res.status(400).json({
            message: "A valid bank account is required."
        });
    }

    const cleanAccountId = Number(accountId);
    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const walletResult = await client.query(
            `SELECT
                wallet_id,
                user_id,
                balance,
                status
            FROM wallet
            WHERE user_id = $1
            LIMIT 1
            FOR UPDATE;`,
            [req.user.user_id]
        );

        if (walletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                message: "Wallet not found for this user."
            });
        }

        const wallet = walletResult.rows[0];

        if (wallet.status !== "active") {
            await client.query("ROLLBACK");
            return res.status(403).json({
                message: "Wallet is not active. Withdrawal cannot be processed."
            });
        }

        const accountResult = await client.query(
            `SELECT
                uad.user_account_id,
                uad.account_number,
                b.bank_name
            FROM user_account_details uad
            INNER JOIN bank b ON b.bank_id = uad.bank_id
            WHERE uad.user_account_id = $1
              AND uad.user_id = $2
            LIMIT 1;`,
            [cleanAccountId, req.user.user_id]
        );

        if (accountResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "Bank account not found for this user."
            });
        }

        const destinationAccount = accountResult.rows[0];
        const walletBalance = Number(wallet.balance);

        if (!Number.isFinite(walletBalance) || walletBalance < amount) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "Insufficient wallet balance."
            });
        }

        const withdrawalType = await findOrCreateTransactionType(
            client,
            "withdrawal",
            "Funds withdrawn from a user wallet to a registered bank account."
        );
        const completedStatus = await findOrCreateTransactionStatus(client, "completed");

        const updatedWalletResult = await client.query(
            `UPDATE wallet
             SET balance = balance - $1
             WHERE wallet_id = $2
               AND balance >= $1
             RETURNING wallet_id, user_id, balance, status;`,
            [amount, wallet.wallet_id]
        );

        if (updatedWalletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "Insufficient wallet balance."
            });
        }

        const updatedWallet = updatedWalletResult.rows[0];
        const referenceNumber = `WTH-${Date.now()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

        const transactionResult = await client.query(
            `INSERT INTO transactions (
                sender_wallet_id,
                receiver_wallet_id,
                user_account_id,
                initiated_by_user_id,
                transaction_type_id,
                transaction_status_id,
                amount,
                transaction_datetime,
                description,
                reference_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
            RETURNING reference_number, amount;`,
            [
                updatedWallet.wallet_id,
                null,
                destinationAccount.user_account_id,
                req.user.user_id,
                withdrawalType.transaction_type_id,
                completedStatus.transaction_status_id,
                amount,
                "Withdraw funds from wallet to registered bank account.",
                referenceNumber
            ]
        );

        await client.query("COMMIT");

        const transaction = transactionResult.rows[0];
        const maskedAccountNumber = destinationAccount.account_number.length > 4
            ? `****${destinationAccount.account_number.slice(-4)}`
            : "****";

        return res.status(200).json({
            message: "Withdrawal successful.",
            transaction_reference: transaction.reference_number,
            withdrawn_amount: Number(transaction.amount),
            updated_wallet_balance: Number(updatedWallet.balance),
            transaction_status: completedStatus.status_name,
            destination_account: {
                account_id: destinationAccount.user_account_id,
                bank_name: destinationAccount.bank_name,
                account_number: maskedAccountNumber
            },
            wallet: {
                wallet_id: updatedWallet.wallet_id,
                user_id: updatedWallet.user_id,
                status: updatedWallet.status,
                balance: Number(updatedWallet.balance)
            }
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }
        console.error("Withdrawal error:", error);
        return res.status(500).json({
            message: "Database error while processing withdrawal."
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

router.get("/transactions", authenticateToken, async (req, res) => {
    try {
        const walletResult = await pool.query(
            `SELECT
                wallet_id,
                user_id,
                status
            FROM wallet
            WHERE user_id = $1
              AND status = 'active'
            LIMIT 1;`,
            [req.user.user_id]
        );

        if (walletResult.rows.length === 0) {
            return res.status(404).json({
                message: "Wallet not found for this user."
            });
        }

        const wallet = walletResult.rows[0];

        const result = await pool.query(
            `SELECT
                t.transaction_id,
                t.amount,
                t.transaction_datetime,
                t.description,
                t.reference_number,
                tt.type_name AS transaction_type,
                ts.status_name AS transaction_status,
                t.sender_wallet_id,
                t.receiver_wallet_id
            FROM transactions t
            INNER JOIN transaction_type tt ON tt.transaction_type_id = t.transaction_type_id
            INNER JOIN transaction_status ts ON ts.transaction_status_id = t.transaction_status_id
            WHERE t.sender_wallet_id = $1
               OR t.receiver_wallet_id = $1
               OR t.initiated_by_user_id = $2
            ORDER BY t.transaction_datetime DESC;`,
            [wallet.wallet_id, req.user.user_id]
        );

        return res.status(200).json({
            transactions: result.rows.map((transaction) => ({
                transaction_id: transaction.transaction_id,
                amount: Number(transaction.amount),
                transaction_datetime: transaction.transaction_datetime,
                description: transaction.description,
                reference_number: transaction.reference_number,
                transaction_type: transaction.transaction_type,
                transaction_status: transaction.transaction_status,
                sender_wallet_id: transaction.sender_wallet_id,
                receiver_wallet_id: transaction.receiver_wallet_id
            }))
        });
    } catch (error) {
        console.error("Get wallet transactions error:", error);
        return res.status(500).json({
            message: "Database error while fetching transaction history."
        });
    }
});

module.exports = router;
