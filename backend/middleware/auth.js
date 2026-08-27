const jwt = require("jsonwebtoken");

const blacklistedTokenIds = new Set();

const addTokenToBlacklist = (token) => {
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        if (decodedToken && decodedToken.jti) {
            blacklistedTokenIds.add(decodedToken.jti);
            return true;
        }

        return false;
    } catch (error) {
        console.error("Failed to blacklist token:", error.message);
        return false;
    }
};

const isTokenBlacklisted = (token) => {
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        return decodedToken && decodedToken.jti ? blacklistedTokenIds.has(decodedToken.jti) : false;
    } catch (error) {
        return false;
    }
};

const authenticateToken = (req, res, next) => {
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

    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        if (isTokenBlacklisted(token)) {
            return res.status(401).json({
                message: "Session has been invalidated. Please log in again."
            });
        }

        req.user = decodedToken;
        return next();
    } catch (error) {
        console.error("JWT verification error:", error.message);
        return res.status(401).json({
            message: "Invalid or expired token."
        });
    }
};

module.exports = {
    authenticateToken,
    addTokenToBlacklist,
    isTokenBlacklisted
};
