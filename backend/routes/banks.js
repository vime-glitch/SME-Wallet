const express = require("express");
const pool = require("../config/database");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                bank_id,
                bank_name
             FROM bank
             ORDER BY bank_id;`
        );

        return res.status(200).json({
            banks: result.rows
        });
    } catch (error) {
        console.error("Get banks error:", error);
        return res.status(500).json({
            message: "Database error while retrieving banks."
        });
    }
});

module.exports = router;
