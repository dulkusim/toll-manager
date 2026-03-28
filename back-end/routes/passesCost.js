const express = require("express");
const router = express.Router();
const pool = require("../utils/db.config");
const { Parser } = require("json2csv");

// Helper: format a JS Date or DB timestamp string to "YYYY-MM-DD HH:mm"
function formatTimestamp(value) {
    const d = new Date(value);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
}

// GET /passesCost/:tollOpID/:tagOpID/:date_from/:date_to
router.get("/passesCost/:tollOpID?/:tagOpID?/:date_from?/:date_to?", async (req, res) => {
    const { tollOpID, tagOpID, date_from, date_to } = req.params;
    const { format = "json" } = req.query;
    const requestTimestamp = formatTimestamp(new Date());

    // Validate input
    if (!tollOpID || !tagOpID || !date_from || !date_to) {
        return res.status(400).json({ error: "Bad Request", message: "Missing required parameters." });
    }

    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(date_from) || !dateRegex.test(date_to)) {
        return res.status(400).json({ error: "Bad Request", message: "Invalid date format. Use YYYYMMDD." });
    }

    const startDate = `${date_from.substring(0, 4)}-${date_from.substring(4, 6)}-${date_from.substring(6, 8)} 00:00:00`;
    const endDate = `${date_to.substring(0, 4)}-${date_to.substring(4, 6)}-${date_to.substring(6, 8)} 23:59:59`;

    try {
        // Validate tollOpID against tollcompanies
        const [tollOpCheck] = await pool.query(
            `SELECT company_id FROM tollcompanies WHERE company_id = ?`,
            [tollOpID]
        );
        if (tollOpCheck.length === 0) {
            return res.status(400).json({ error: "Bad Parameter", message: "Toll operator ID is invalid." });
        }

        // Validate tagOpID against tollcompanies
        const [tagOpCheck] = await pool.query(
            `SELECT company_id FROM tollcompanies WHERE company_id = ?`,
            [tagOpID]
        );
        if (tagOpCheck.length === 0) {
            return res.status(400).json({ error: "Bad Parameter", message: "Tag operator ID is invalid." });
        }

        const [results] = await pool.query(
            `SELECT COUNT(*) AS nPasses, SUM(p.charge) AS passesCost
             FROM passes p
             JOIN tollstations t ON p.station_id = t.station_id
             JOIN vehicletags v ON p.tag_id = v.tag_id
             WHERE t.company_id = ? 
             AND v.company_id = ? 
             AND p.timestamp BETWEEN ? AND ?`,
            [tollOpID, tagOpID, startDate, endDate]
        );

        if (!results || results.length === 0 || results[0].nPasses === 0) {
            return res.status(204).send();
        }

        const response = {
            tollOpID: tollOpID,
            tagOpID: tagOpID,
            requestTimestamp: requestTimestamp,
            periodFrom: formatTimestamp(new Date(startDate)),
            periodTo: formatTimestamp(new Date(endDate)),
            nPasses: results[0].nPasses,
            passesCost: parseFloat(results[0].passesCost) || 0.0
        };

        if (format === "csv") {
            try {
                const json2csvParser = new Parser();
                const csvData = json2csvParser.parse([response]);
                res.header("Content-Type", "text/csv");
                res.attachment("passesCost.csv");
                return res.send(csvData);
            } catch (csvError) {
                console.error("CSV Conversion Error:", csvError);
                return res.status(500).json({ error: "CSV conversion failed", details: csvError.message });
            }
        }

        res.json(response);

    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

module.exports = router;