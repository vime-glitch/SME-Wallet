const express = require("express");
const pool = require("./config/database");
const app = express();

const PORT = 5000;

app.get("/", (req, res) => {
    res.send("SME Wallet backend is running!")
});

app.get("/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({
            message: "Database connection successful!",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);
        res.status(500).json({
            message: "Database connection failed"
        });
    }
});

const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

