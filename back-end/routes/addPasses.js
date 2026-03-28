const express = require("express");
const router = express.Router();
const pool = require("../utils/db.config");
const csv = require("csv-parser");
const multer = require("multer");
const { Readable } = require("stream");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/admin/addpasses", upload.single("file"), async (req, res) => {
    try {
        console.log("🚀 Starting import of passes data...");

        if (!req.file) {
            return res.status(400).json({ status: "failed", info: "No file uploaded." });
        }

        // Parse CSV from uploaded file buffer
        const rows = await new Promise((resolve, reject) => {
            const results = [];
            const stream = Readable.from(req.file.buffer);

            stream
                .pipe(csv({
                    separator: ",",
                    mapHeaders: ({ header, index }) => {
                        const headersMap = {
                            0: "timestamp",
                            1: "station_id",
                            2: "tag_id",
                            3: "company_id",
                            4: "charge"
                        };
                        return headersMap[index] || null;
                    }
                }))
                .on("data", (row) => {
                    const timestamp = row["timestamp"]?.trim();
                    const station_id = row["station_id"]?.trim();
                    const tag_id = row["tag_id"]?.trim();
                    const company_id = row["company_id"]?.trim().toUpperCase();
                    const charge = parseFloat(row["charge"]) || 0.00;

                    if (!timestamp || !station_id || !tag_id || !company_id) {
                        console.warn(`⚠️ Skipping row - Missing required fields: ${JSON.stringify(row)}`);
                        return;
                    }

                    results.push({ timestamp, station_id, tag_id, company_id, charge });
                })
                .on("end", () => resolve(results))
                .on("error", (err) => reject(err));
        });

        // Insert all rows sequentially to avoid race conditions
        for (const row of rows) {
            const { timestamp, station_id, tag_id, company_id, charge } = row;

            // Insert tag if not exists
            await pool.query(
                `INSERT INTO vehicletags (tag_id, company_id)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE company_id = VALUES(company_id)`,
                [tag_id, company_id]
            );

            // Determine pass_type
            const [stationResults] = await pool.query(
                `SELECT company_id AS station_company FROM tollstations WHERE station_id = ?`,
                [station_id]
            );

            if (stationResults.length === 0) {
                console.warn(`⚠️ Skipping row - No station found for station_id: ${station_id}`);
                continue;
            }

            const station_company = stationResults[0].station_company;
            const pass_type = station_company === company_id ? "home" : "visitor";

            // Insert pass
            await pool.query(
                `INSERT INTO passes (station_id, tag_id, timestamp, charge, pass_type)
                 VALUES (?, ?, ?, ?, ?)`,
                [station_id, tag_id, timestamp, charge, pass_type]
            );
        }

        console.log("✅ Import completed successfully.");
        res.json({ status: "OK" });

    } catch (err) {
        console.error("❌ Import error:", err.message);
        res.status(500).json({ status: "failed", info: err.message });
    }
});

module.exports = router;