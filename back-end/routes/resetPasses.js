const express = require("express");
const router = express.Router();
const pool = require("../utils/db.config");
const bcrypt = require("bcrypt");

router.post("/admin/resetpasses", async (req, res) => {
    try {
        console.log("🗑️ Starting cleanup of passes and related data...");

        await pool.query("DELETE FROM passes");
        await pool.query("DELETE FROM vehicletags");

        await pool.query("ALTER TABLE passes AUTO_INCREMENT = 1");
        await pool.query("ALTER TABLE vehicletags AUTO_INCREMENT = 1");

        // Reset admin account to default credentials
        const hashedPassword = await bcrypt.hash("freepasses4all", 10);
        await pool.query(
            `INSERT INTO users (username, password_hash) VALUES ('admin', ?)
             ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
            [hashedPassword]
        );

        console.log("✅ Passes and tags data cleared successfully.");
        res.json({ status: "OK" });

    } catch (err) {
        console.error("❌ Clear error:", err.message);
        res.status(500).json({ status: "failed", info: err.message });
    }
});

module.exports = router;