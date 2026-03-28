const db = require("../utils/db.config");

const verifyToken = async (req, res, next) => {
    const token = req.header("X-OBSERVATORY-AUTH");

    if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    try {
        const [rows] = await db.query("SELECT * FROM tokens WHERE token = ?", [token]);

        if (rows.length === 0) {
            return res.status(401).json({ error: "Unauthorized: Invalid token" });
        }

        req.user = rows[0].user_id;
        next();

    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = verifyToken;