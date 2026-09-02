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

const findOrCreateTransactionType = async (client, typeName) => {
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
        [typeName, "Funds deposited into a user wallet."]
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

module.exports = router;
