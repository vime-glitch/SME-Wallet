const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/database");
const { authenticateToken, addTokenToBlacklist } = require("../middleware/auth");

const router = express.Router();

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const issueToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is missing from environment variables.");
    }

    const tokenPayload = {
        user_id: user.user_id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        jti: crypto.randomUUID()
    };

    return jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1h" });
};

const isValidPostgresDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    return (
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day
    );
};

router.post("/register", async (req, res) => {
    const {
        fname,
        lname,
        ph_number,
        email,
        location,
        postal_address,
        password,
        account_type,
        business_name,
        business_type,
        business_address,
        date_registered,
        bank_id: bankId,
        account_number: accountNumber
    } = req.body;

    const requiredFields = ["fname", "lname", "ph_number", "email", "location", "postal_address", "password", "account_type"];
    const missingField = requiredFields.find((field) => {
        const value = req.body[field];
        return value === undefined || value === null || String(value).trim() === "";
    });

    if (missingField) {
        return res.status(400).json({
            message: `All required fields must be provided: fname, lname, ph_number, email, location, postal_address, password, account_type.`
        });
    }

    const trimmedFirstName = String(fname).trim();
    const trimmedLastName = String(lname).trim();
    const trimmedPhone = String(ph_number).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedLocation = String(location).trim();
    const trimmedPostalAddress = String(postal_address).trim();
    const trimmedPassword = String(password);
    const trimmedAccountType = String(account_type).trim().toLowerCase();

    if (!trimmedFirstName || !trimmedLastName || !trimmedPhone || !trimmedEmail || !trimmedLocation || !trimmedPostalAddress || !trimmedPassword || !trimmedAccountType) {
        return res.status(400).json({
            message: "All fields must be non-empty strings."
        });
    }

    const validAccountTypes = ["customer", "sme", "both"];

    if (!validAccountTypes.includes(trimmedAccountType)) {
        return res.status(400).json({
            message: "Invalid account_type. Allowed values: customer, sme, both."
        });
    }

    const requiresSmeProfile = ["sme", "both"].includes(trimmedAccountType);
    const requiresCustomerProfile = ["customer", "both"].includes(trimmedAccountType);

    let trimmedBusinessName = "";
    let trimmedBusinessType = "";
    let trimmedBusinessAddress = "";
    let trimmedDateRegistered = "";

    if (requiresSmeProfile) {
        trimmedBusinessName = String(business_name ?? "").trim();
        trimmedBusinessType = String(business_type ?? "").trim();
        trimmedBusinessAddress = String(business_address ?? "").trim();
        trimmedDateRegistered = String(date_registered ?? "").trim();

        if (!trimmedBusinessName || !trimmedBusinessType || !trimmedBusinessAddress || !trimmedDateRegistered) {
            return res.status(400).json({
                message: "Business name, business type, business address, and date registered are required for SME registrations."
            });
        }

        if (!isValidPostgresDate(trimmedDateRegistered)) {
            return res.status(400).json({
                message: "date_registered must be a valid PostgreSQL date in YYYY-MM-DD format."
            });
        }
    }

    if (!validateEmail(trimmedEmail)) {
        return res.status(400).json({
            message: "Invalid email format."
        });
    }

    if (trimmedPassword.length < 8) {
        return res.status(400).json({
            message: "Password must be at least 8 characters long."
        });
    }

    const hasBankId = bankId !== undefined && bankId !== null;
    const hasAccountNumber = accountNumber !== undefined && accountNumber !== null;

    if (hasBankId !== hasAccountNumber) {
        return res.status(400).json({
            message: "bank_id and account_number must be provided together."
        });
    }

    let cleanBankId = null;
    let trimmedAccountNumber = "";

    if (hasBankId && hasAccountNumber) {
        if (
            (typeof bankId !== "number" && typeof bankId !== "string") ||
            (typeof bankId === "string" && bankId.trim() === "") ||
            !Number.isInteger(Number(bankId)) ||
            Number(bankId) <= 0
        ) {
            return res.status(400).json({
                message: "bank_id must be a positive integer."
            });
        }

        if (typeof accountNumber !== "string") {
            return res.status(400).json({
                message: "account_number must be a non-empty string."
            });
        }

        trimmedAccountNumber = accountNumber.trim();

        if (!trimmedAccountNumber) {
            return res.status(400).json({
                message: "account_number must be a non-empty string."
            });
        }

        cleanBankId = Number(bankId);
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        if (cleanBankId !== null) {
            const bankResult = await client.query(
                "SELECT bank_id FROM bank WHERE bank_id = $1 LIMIT 1",
                [cleanBankId]
            );

            if (bankResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    message: "Selected bank does not exist."
                });
            }
        }

        const emailExistsResult = await client.query(
            "SELECT user_id FROM user_contact_info WHERE email = $1",
            [trimmedEmail]
        );

        if (emailExistsResult.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(trimmedPassword, 12);

        const userResult = await client.query(
            "INSERT INTO users (fname, lname, created_at) VALUES ($1, $2, NOW()) RETURNING user_id",
            [trimmedFirstName, trimmedLastName]
        );

        const userId = userResult.rows[0].user_id;

        if (cleanBankId !== null) {
            await client.query(
                `INSERT INTO user_account_details (
                    user_id,
                    bank_id,
                    account_number,
                    account_name,
                    account_type
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                    userId,
                    cleanBankId,
                    trimmedAccountNumber,
                    `${trimmedFirstName} ${trimmedLastName}`,
                    "savings"
                ]
            );
        }

        await client.query(
            "INSERT INTO user_contact_info (user_id, ph_number, email, location, postal_address) VALUES ($1, $2, $3, $4, $5)",
            [userId, trimmedPhone, trimmedEmail, trimmedLocation, trimmedPostalAddress]
        );

        await client.query(
            "INSERT INTO user_authentication (user_id, password_hash, is_active, created_at) VALUES ($1, $2, TRUE, NOW())",
            [userId, passwordHash]
        );

        const assignedRoles = [];

        if (requiresCustomerProfile) {
            const customerRoleResult = await client.query(
                "SELECT role_id FROM role WHERE role_name = $1 LIMIT 1",
                ["Customer"]
            );

            if (customerRoleResult.rows.length === 0) {
                throw new Error("Customer role record not found.");
            }

            const customerRoleId = customerRoleResult.rows[0].role_id;

            await client.query(
                "INSERT INTO user_role (user_id, role_id, assigned_date) VALUES ($1, $2, NOW())",
                [userId, customerRoleId]
            );

            await client.query(
                "INSERT INTO customer (user_id, created_at) VALUES ($1, NOW())",
                [userId]
            );

            assignedRoles.push("Customer");
        }

        if (requiresSmeProfile) {
            const smeRoleResult = await client.query(
                "SELECT role_id FROM role WHERE role_name = $1 LIMIT 1",
                ["SME"]
            );

            if (smeRoleResult.rows.length === 0) {
                throw new Error("SME role record not found.");
            }

            const smeRoleId = smeRoleResult.rows[0].role_id;

            await client.query(
                "INSERT INTO user_role (user_id, role_id, assigned_date) VALUES ($1, $2, NOW())",
                [userId, smeRoleId]
            );

            await client.query(
                "INSERT INTO sme (user_id, business_name, business_type, business_address, date_registered, is_active, created_at) VALUES ($1, $2, $3, $4, $5, TRUE, NOW())",
                [userId, trimmedBusinessName, trimmedBusinessType, trimmedBusinessAddress, trimmedDateRegistered]
            );

            assignedRoles.push("SME");
        }

        const walletResult = await client.query(
            "INSERT INTO wallet (user_id, balance, status, created_date) VALUES ($1, 0.00, 'active', NOW()) RETURNING wallet_id, balance, status",
            [userId]
        );

        await client.query("COMMIT");

        const response = {
            message: "User registered successfully.",
            user: {
                user_id: userId,
                fname: trimmedFirstName,
                lname: trimmedLastName,
                email: trimmedEmail,
                ph_number: trimmedPhone,
                location: trimmedLocation,
                postal_address: trimmedPostalAddress
            },
            account_type: trimmedAccountType,
            roles: assignedRoles,
            wallet: {
                wallet_id: walletResult.rows[0].wallet_id,
                balance: walletResult.rows[0].balance,
                status: walletResult.rows[0].status
            }
        };

        if (requiresCustomerProfile) {
            response.customer = {
                user_id: userId
            };
        }

        if (requiresSmeProfile) {
            response.sme = {
                user_id: userId,
                business_name: trimmedBusinessName,
                business_type: trimmedBusinessType,
                business_address: trimmedBusinessAddress,
                date_registered: trimmedDateRegistered
            };
        }

        return res.status(201).json(response);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});

        console.error("Registration Error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "A duplicate record already exists."
            });
        }

        return res.status(500).json({
            message: "Database error while registering user."
        });
    } finally {
        client.release();
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required."
        });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedPassword = String(password);

    if (!validateEmail(trimmedEmail)) {
        return res.status(400).json({
            message: "Invalid email format."
        });
    }

    try {
        const userResult = await pool.query(
            `SELECT
                u.user_id,
                u.fname,
                u.lname,
                c.email,
                a.password_hash,
                a.is_active
            FROM users u
            INNER JOIN user_contact_info c ON c.user_id = u.user_id
            INNER JOIN user_authentication a ON a.user_id = u.user_id
            WHERE c.email = $1
            LIMIT 1;`,
            [trimmedEmail]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                message: "Your account is inactive. Contact support."
            });
        }

        const isPasswordValid = await bcrypt.compare(trimmedPassword, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is missing from environment variables.");
            return res.status(500).json({
                message: "Authentication configuration error."
            });
        }

        const token = issueToken(user);

        return res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                user_id: user.user_id,
                fname: user.fname,
                lname: user.lname,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({
            message: "Database error while logging in."
        });
    }
});

router.get("/me", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                u.user_id,
                u.fname,
                u.lname,
                c.ph_number,
                c.email,
                c.location,
                c.postal_address,
                a.is_active
            FROM users u
            INNER JOIN user_contact_info c ON c.user_id = u.user_id
            INNER JOIN user_authentication a ON a.user_id = u.user_id
            WHERE u.user_id = $1
            LIMIT 1;`,
            [req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        const user = result.rows[0];

        return res.status(200).json({
            user: {
                user_id: user.user_id,
                fname: user.fname,
                lname: user.lname,
                ph_number: user.ph_number,
                email: user.email,
                location: user.location,
                postal_address: user.postal_address,
                is_active: user.is_active
            }
        });
    } catch (error) {
        console.error("Get current user error:", error);
        return res.status(500).json({
            message: "Database error while fetching user profile."
        });
    }
});

router.post("/logout", authenticateToken, async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Access token is required."
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Access token is required."
        });
    }

    const wasBlacklisted = addTokenToBlacklist(token);

    if (!wasBlacklisted) {
        return res.status(400).json({
            message: "Unable to invalidate session."
        });
    }

    return res.status(200).json({
        message: "Logged out successfully."
    });
});

module.exports = router;