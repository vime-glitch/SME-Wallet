const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
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

const validateWithdrawalAmount = (value) => {
    const validation = validateDepositAmount(value);

    if (!validation.valid) {
        return {
            valid: false,
            message: validation.message.replace("Deposit", "Withdrawal")
        };
    }

    if (Number(validation.value.toFixed(2)) !== validation.value) {
        return {
            valid: false,
            message: "Withdrawal amount can have no more than two decimal places."
        };
    }

    return validation;
};

const validateBankAccountIdentifier = (value, label = "bank account") => {
    if (value === undefined || value === null || value === "") {
        return {
            valid: false,
            message: `${label} is required.`
        };
    }

    if (
        (typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && value.trim() === "") ||
        !Number.isInteger(Number(value)) ||
        Number(value) <= 0
    ) {
        return {
            valid: false,
            message: `A valid ${label} is required.`
        };
    }

    return {
        valid: true,
        value: Number(value)
    };
};

const WITHDRAWAL_OTP_ATTEMPT_LIMIT = 5;
const WITHDRAWAL_OTP_TTL_MS = 5 * 60 * 1000;
const WITHDRAWAL_REQUEST_LOCK_KEY = 874231;

const getOtpConfiguration = () => {
    const nodeEnv = String(process.env.NODE_ENV || "").trim();
    const devOtpFlag = String(process.env.ALLOW_DEV_OTP || "").trim();

    if (devOtpFlag && devOtpFlag !== "true" && devOtpFlag !== "false") {
        throw new Error("ALLOW_DEV_OTP must be either true or false.");
    }

    if (devOtpFlag === "true" && nodeEnv !== "development") {
        throw new Error("ALLOW_DEV_OTP=true is only permitted when NODE_ENV=development.");
    }

    const secret = process.env.OTP_HMAC_SECRET;
    if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
        throw new Error("OTP_HMAC_SECRET must contain at least 32 bytes.");
    }

    return {
        secret,
        developmentOtpEnabled: nodeEnv === "development" && devOtpFlag === "true"
    };
};

const hashOtpValue = (value, secret) => {
    const normalized = String(value ?? "").trim();
    return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
};

const compareOtpHash = (inputOtp, expectedHash, secret) => {
    const normalizedInput = String(inputOtp ?? "").trim();

    if (!/^\d{6}$/.test(normalizedInput) || !/^[a-f0-9]{64}$/i.test(String(expectedHash || ""))) {
        return false;
    }

    try {
        const actualHash = hashOtpValue(normalizedInput, secret);
        const inputBuffer = Buffer.from(actualHash, "hex");
        const expectedBuffer = Buffer.from(expectedHash, "hex");

        if (inputBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
    } catch (error) {
        return false;
    }
};

const getDevelopmentOtpResponse = (otp, developmentOtpEnabled) => {
    if (!developmentOtpEnabled) {
        return {};
    }
    return {
        development_otp: otp,
        mode: "development-only"
    };
};

const ensureWithdrawalAccess = async (client, userId) => {
    const result = await client.query(
        `SELECT 1
         FROM customer c
         INNER JOIN user_role ur ON ur.user_id = c.user_id
         INNER JOIN role r ON r.role_id = ur.role_id
         WHERE c.user_id = $1
           AND LOWER(r.role_name) = 'customer'
         LIMIT 1;`,
        [userId]
    );

    return result.rows.length > 0;
};

const findUserBankAccount = async (client, userId, accountId) => {
    const result = await client.query(
        `SELECT
            uad.user_account_id,
            uad.account_number,
            uad.user_id,
            b.bank_name
         FROM user_account_details uad
         INNER JOIN bank b ON b.bank_id = uad.bank_id
         WHERE uad.user_account_id = $1
           AND uad.user_id = $2
         LIMIT 1;`,
        [accountId, userId]
    );

    return result.rows[0] || null;
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

const ensureWithdrawalVerificationTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS withdrawal_verification (
            verification_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            user_id integer NOT NULL,
            amount numeric(18,2) NOT NULL,
            bank_account_id integer NOT NULL,
            otp_hash varchar(255) NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'verified', 'used', 'expired', 'invalidated')),
            created_at timestamptz NOT NULL DEFAULT now(),
            expires_at timestamptz NOT NULL,
            verified_at timestamptz,
            used_at timestamptz,
            attempt_count integer NOT NULL DEFAULT 0,
            last_requested_at timestamptz,
            authorization_jti varchar(255),
            CONSTRAINT fk_withdrawal_verification_user
                FOREIGN KEY (user_id)
                REFERENCES users (user_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE,
            CONSTRAINT fk_withdrawal_verification_account
                FOREIGN KEY (bank_account_id)
                REFERENCES user_account_details (user_account_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_withdrawal_verification_user_active
            ON withdrawal_verification (user_id, status, created_at DESC);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_withdrawal_verification_account
            ON withdrawal_verification (bank_account_id, status, created_at DESC);
    `);
};

const withdrawalVerificationReady = ensureWithdrawalVerificationTable();
withdrawalVerificationReady.catch((error) => {
    console.error("Failed to initialise withdrawal verification table:", error.message);
});

const generateWithdrawalOtp = () => crypto.randomInt(100000, 1000000).toString().padStart(6, "0");

const buildWithdrawalOtpResponse = (otp, developmentOtpEnabled) => {
    return {
        ...getDevelopmentOtpResponse(otp, developmentOtpEnabled),
        message: developmentOtpEnabled
            ? "Development OTP issued for local testing."
            : "OTP delivery is not configured in this environment.",
        development_mode: developmentOtpEnabled
    };
};

router.post("/withdraw/otp/request", authenticateToken, async (req, res) => {
    const { amount, account_id: accountId } = req.body;
    const amountValidation = validateWithdrawalAmount(amount);
    const accountValidation = validateBankAccountIdentifier(accountId, "bank account");

    if (!amountValidation.valid) {
        return res.status(400).json({ message: amountValidation.message });
    }

    if (!accountValidation.valid) {
        return res.status(400).json({ message: accountValidation.message });
    }

    const cleanAmount = Number(amountValidation.value);
    const cleanAccountId = accountValidation.value;

    let client;
    try {
        const otpConfiguration = getOtpConfiguration();
        await withdrawalVerificationReady;
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query(
            "SELECT pg_advisory_xact_lock($1, $2);",
            [WITHDRAWAL_REQUEST_LOCK_KEY, req.user.user_id]
        );

        const userHasCustomerRole = await ensureWithdrawalAccess(client, req.user.user_id);
        if (!userHasCustomerRole) {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Only users with the Customer role can withdraw funds." });
        }

        const walletResult = await client.query(
            `SELECT wallet_id, user_id, balance, status
             FROM wallet
             WHERE user_id = $1
             LIMIT 1;`,
            [req.user.user_id]
        );

        if (walletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Wallet not found for this user." });
        }

        const wallet = walletResult.rows[0];
        if (wallet.status !== "active") {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Wallet is not active. Withdrawal cannot be processed." });
        }

        const account = await findUserBankAccount(client, req.user.user_id, cleanAccountId);
        if (!account) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Bank account not found for this user." });
        }

        const walletBalance = Number(wallet.balance);
        if (!Number.isFinite(walletBalance) || walletBalance < cleanAmount) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Insufficient wallet balance." });
        }

        const recentRequest = await client.query(
            `SELECT created_at
             FROM withdrawal_verification
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 1;`,
            [req.user.user_id]
        );

        if (recentRequest.rows.length > 0) {
            const lastRequestedAt = new Date(recentRequest.rows[0].created_at);
            const secondsSinceRequest = (Date.now() - lastRequestedAt.getTime()) / 1000;

            if (secondsSinceRequest < 60) {
                await client.query("ROLLBACK");
                return res.status(429).json({ message: "Please wait a moment before requesting another OTP." });
            }
        }

        const recentWindow = await client.query(
            `SELECT COUNT(*) AS request_count
             FROM withdrawal_verification
             WHERE user_id = $1
               AND created_at > NOW() - INTERVAL '15 minutes';`,
            [req.user.user_id]
        );

        if (Number(recentWindow.rows[0].request_count) >= 5) {
            await client.query("ROLLBACK");
            return res.status(429).json({ message: "Too many OTP requests. Please try again later." });
        }

        const otp = generateWithdrawalOtp();
        const otpHash = hashOtpValue(otp, otpConfiguration.secret);
        const expiresAt = new Date(Date.now() + WITHDRAWAL_OTP_TTL_MS);

        await client.query(
            `UPDATE withdrawal_verification
             SET status = 'invalidated', used_at = NOW()
             WHERE user_id = $1
               AND status IN ('active', 'verified');`,
            [req.user.user_id]
        );

        const insertResult = await client.query(
            `INSERT INTO withdrawal_verification (
                user_id,
                amount,
                bank_account_id,
                otp_hash,
                status,
                created_at,
                expires_at,
                last_requested_at,
                attempt_count
            ) VALUES ($1, $2, $3, $4, 'active', NOW(), $5, NOW(), 0)
            RETURNING verification_id, expires_at;`,
            [req.user.user_id, cleanAmount, cleanAccountId, otpHash, expiresAt]
        );

        await client.query("COMMIT");
        const response = buildWithdrawalOtpResponse(
            otp,
            otpConfiguration.developmentOtpEnabled
        );

        return res.status(200).json({
            ...response,
            verification_id: insertResult.rows[0].verification_id,
            expires_at: insertResult.rows[0].expires_at,
            request_cooldown_seconds: 60,
            max_requests_per_window: 5
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }
        if (error.message.includes("OTP_HMAC_SECRET") || error.message.includes("ALLOW_DEV_OTP")) {
            console.error("Withdrawal OTP configuration error:", error.message);
            return res.status(503).json({ message: "Withdrawal verification is not configured." });
        }
        console.error("Request withdrawal OTP error:", error);
        return res.status(500).json({ message: "Unable to request withdrawal verification." });
    } finally {
        if (client) {
            client.release();
        }
    }
});

router.post("/withdraw/otp/verify", authenticateToken, async (req, res) => {
    const { otp, amount, account_id: accountId } = req.body;

    const validation = validateWithdrawalAmount(amount);
    const accountValidation = validateBankAccountIdentifier(accountId, "bank account");

    if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
    }

    if (!accountValidation.valid) {
        return res.status(400).json({ message: accountValidation.message });
    }

    const cleanAmount = Number(validation.value);
    const cleanAccountId = accountValidation.value;

    if (!/^\d{6}$/.test(String(otp ?? ""))) {
        return res.status(401).json({ message: "OTP is invalid or no longer usable." });
    }

    let client;
    try {
        const otpConfiguration = getOtpConfiguration();
        await withdrawalVerificationReady;
        client = await pool.connect();
        await client.query("BEGIN");

        const challengeResult = await client.query(
            `SELECT *
             FROM withdrawal_verification
             WHERE user_id = $1
               AND status = 'active'
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE;`,
            [req.user.user_id]
        );

        if (challengeResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(401).json({ message: "OTP is invalid or no longer usable." });
        }

        const challenge = challengeResult.rows[0];
        if (new Date(challenge.expires_at).getTime() <= Date.now()) {
            await client.query(
                `UPDATE withdrawal_verification
                 SET status = 'expired', used_at = NOW()
                 WHERE verification_id = $1 AND status = 'active';`,
                [challenge.verification_id]
            );
            await client.query("COMMIT");
            return res.status(401).json({ message: "OTP is invalid or no longer usable." });
        }

        const matchesOtp = compareOtpHash(otp, challenge.otp_hash, otpConfiguration.secret);
        const matchesWithdrawal = Number(challenge.amount) === cleanAmount &&
            Number(challenge.bank_account_id) === cleanAccountId;

        if (!matchesOtp || !matchesWithdrawal) {
            const attemptResult = await client.query(
                `UPDATE withdrawal_verification
                 SET attempt_count = attempt_count + 1,
                     status = CASE
                         WHEN attempt_count + 1 >= $2 THEN 'invalidated'
                         ELSE status
                     END,
                     used_at = CASE
                         WHEN attempt_count + 1 >= $2 THEN NOW()
                         ELSE used_at
                     END
                 WHERE verification_id = $1
                   AND status = 'active'
                   AND expires_at > NOW()
                 RETURNING status;`,
                [challenge.verification_id, WITHDRAWAL_OTP_ATTEMPT_LIMIT]
            );

            if (attemptResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(401).json({ message: "OTP is invalid or no longer usable." });
            }

            await client.query("COMMIT");
            return res.status(401).json({ message: "OTP is invalid or no longer usable." });
        }

        const authorizationJti = crypto.randomUUID();
        const withdrawalAuthToken = jwt.sign(
            {
                user_id: req.user.user_id,
                jti: authorizationJti,
                verification_id: challenge.verification_id,
                purpose: "withdrawal_authorization",
                amount: cleanAmount,
                account_id: cleanAccountId,
                type: "withdrawal_authorization"
            },
            process.env.JWT_SECRET,
            { expiresIn: "5m" }
        );

        const verifiedResult = await client.query(
            `UPDATE withdrawal_verification
             SET status = 'verified',
                 verified_at = NOW(),
                 authorization_jti = $1
             WHERE verification_id = $2
               AND user_id = $3
               AND status = 'active'
               AND expires_at > NOW()
               AND amount = $4
               AND bank_account_id = $5
             RETURNING verification_id;`,
            [
                authorizationJti,
                challenge.verification_id,
                req.user.user_id,
                cleanAmount,
                cleanAccountId
            ]
        );

        if (verifiedResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(401).json({ message: "OTP is invalid or no longer usable." });
        }

        await client.query("COMMIT");
        return res.status(200).json({
            message: "OTP verified successfully.",
            withdrawal_authorization_token: withdrawalAuthToken,
            expires_in_seconds: 300,
            amount: cleanAmount,
            account_id: cleanAccountId
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }
        if (error.message.includes("OTP_HMAC_SECRET") || error.message.includes("ALLOW_DEV_OTP")) {
            console.error("Withdrawal OTP configuration error:", error.message);
            return res.status(503).json({ message: "Withdrawal verification is not configured." });
        }
        console.error("Verify withdrawal OTP error:", error);
        return res.status(500).json({ message: "Unable to verify withdrawal OTP." });
    } finally {
        if (client) {
            client.release();
        }
    }
});

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

router.get("/accounts", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                uad.user_account_id,
                uad.account_number,
                b.bank_name
             FROM user_account_details uad
             INNER JOIN bank b ON b.bank_id = uad.bank_id
             WHERE uad.user_id = $1
             ORDER BY uad.user_account_id;`,
            [req.user.user_id]
        );

        const accounts = result.rows.map((account) => ({
            account_id: account.user_account_id,
            bank_name: account.bank_name,
            account_number: account.account_number.length > 4
                ? `****${account.account_number.slice(-4)}`
                : "****"
        }));

        return res.status(200).json({ accounts });
    } catch (error) {
        console.error("Get bank accounts error:", error);
        return res.status(500).json({
            message: "Database error while retrieving bank accounts."
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
    const { amount, account_id: accountId, withdrawal_authorization_token: tokenFromBody } = req.body;
    const authHeader = req.headers.authorization || "";
    const authorizationToken = tokenFromBody || (authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "");

    if (!authorizationToken) {
        return res.status(401).json({
            message: "A valid withdrawal authorization is required before completing a withdrawal."
        });
    }

    let decodedAuthorization;
    try {
        decodedAuthorization = jwt.verify(authorizationToken, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            message: "The withdrawal authorization is invalid or expired."
        });
    }

    if (decodedAuthorization.purpose !== "withdrawal_authorization" || decodedAuthorization.type !== "withdrawal_authorization") {
        return res.status(401).json({
            message: "The withdrawal authorization is invalid."
        });
    }

    if (Number(decodedAuthorization.user_id) !== Number(req.user.user_id)) {
        return res.status(403).json({
            message: "This withdrawal authorization does not belong to this user."
        });
    }

    const amountValidation = validateWithdrawalAmount(amount);
    const accountValidation = validateBankAccountIdentifier(accountId, "bank account");

    if (!amountValidation.valid) {
        return res.status(400).json({ message: amountValidation.message });
    }

    if (!accountValidation.valid) {
        return res.status(400).json({ message: accountValidation.message });
    }

    const cleanAmount = Number(amountValidation.value);
    const cleanAccountId = Number(accountValidation.value);

    if (
        !Number.isInteger(decodedAuthorization.verification_id) ||
        typeof decodedAuthorization.jti !== "string" ||
        !decodedAuthorization.jti ||
        Number(decodedAuthorization.amount) !== cleanAmount ||
        Number(decodedAuthorization.account_id) !== cleanAccountId
    ) {
        return res.status(401).json({
            message: "The withdrawal authorization is invalid or no longer usable."
        });
    }

    let client;

    try {
        await withdrawalVerificationReady;
        client = await pool.connect();
        await client.query("BEGIN");

        const authResult = await client.query(
            `SELECT *
             FROM withdrawal_verification
             WHERE verification_id = $1
               AND user_id = $2
               AND authorization_jti = $3
               AND status = 'verified'
               AND expires_at > NOW()
               AND amount = $4
               AND bank_account_id = $5
             LIMIT 1
             FOR UPDATE;`,
            [
                decodedAuthorization.verification_id,
                req.user.user_id,
                decodedAuthorization.jti,
                cleanAmount,
                cleanAccountId
            ]
        );

        if (authResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(401).json({
                message: "The withdrawal authorization is invalid or no longer usable."
            });
        }

        const challenge = authResult.rows[0];
        if (Number(challenge.amount) !== cleanAmount || Number(challenge.bank_account_id) !== cleanAccountId) {
            await client.query("ROLLBACK");
            return res.status(401).json({
                message: "The withdrawal authorization is invalid or no longer usable."
            });
        }

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
            return res.status(404).json({ message: "Wallet not found for this user." });
        }

        const wallet = walletResult.rows[0];
        if (wallet.status !== "active") {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Wallet is not active. Withdrawal cannot be processed." });
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
            return res.status(400).json({ message: "Bank account not found for this user." });
        }

        const destinationAccount = accountResult.rows[0];
        const walletBalance = Number(wallet.balance);
        if (!Number.isFinite(walletBalance) || walletBalance < cleanAmount) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Insufficient wallet balance." });
        }

        const updatedVerificationResult = await client.query(
            `UPDATE withdrawal_verification
             SET status = 'used', used_at = NOW(), authorization_jti = $1
             WHERE verification_id = $2
               AND status = 'verified'
               AND user_id = $3
               AND expires_at > NOW()
               AND amount = $4
               AND bank_account_id = $5
             RETURNING verification_id;`,
            [
                decodedAuthorization.jti,
                challenge.verification_id,
                req.user.user_id,
                cleanAmount,
                cleanAccountId
            ]
        );

        if (updatedVerificationResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "This withdrawal authorization is already in use." });
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
            [cleanAmount, wallet.wallet_id]
        );

        if (updatedWalletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Insufficient wallet balance." });
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
                cleanAmount,
                "Withdraw funds from wallet to registered bank account.",
                referenceNumber
            ]
        );

        await client.query("COMMIT");

        const maskedAccountNumber = destinationAccount.account_number.length > 4
            ? `****${destinationAccount.account_number.slice(-4)}`
            : "****";

        return res.status(200).json({
            message: "Withdrawal successful.",
            transaction_reference: transactionResult.rows[0].reference_number,
            withdrawn_amount: Number(transactionResult.rows[0].amount),
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
