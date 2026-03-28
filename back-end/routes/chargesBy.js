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

// GET /chargesBy/:tollOpID/:date_from/:date_to
router.get("/chargesBy/:tollOpID?/:date_from?/:date_to?", async (req, res) => {
    const { tollOpID, date_from, date_to } = req.params;
    const { format = "json" } = req.query;
    const requestTimestamp = formatTimestamp(new Date());

    // Validate input
    if (!tollOpID || !date_from || !date_to) {
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
        const [tollOpIDcheck] = await pool.query(
            `SELECT company_id FROM tollcompanies WHERE company_id = ?`,
            [tollOpID]
        );
        if (tollOpIDcheck.length === 0) {
            return res.status(400).json({ error: "Bad Request", message: "Toll operator ID is invalid." });
        }

        const [results] = await pool.query(
            `SELECT v.company_id AS visitingOpID, 
                    COUNT(*) AS nPasses, 
                    SUM(p.charge) AS passesCost
             FROM passes p
             JOIN tollstations t ON p.station_id = t.station_id
             JOIN vehicletags v ON p.tag_id = v.tag_id
             WHERE t.company_id = ? 
             AND t.company_id <> v.company_id
             AND p.timestamp BETWEEN ? AND ?
             GROUP BY v.company_id`,
            [tollOpID, startDate, endDate]
        );

        if (!results || results.length === 0) {
            return res.status(204).send();
        }

        const vOpList = results.map(row => ({
            visitingOpID: row.visitingOpID,
            nPasses: row.nPasses,
            passesCost: parseFloat(row.passesCost) || 0.0
        }));

        const response = {
            tollOpID: tollOpID,
            requestTimestamp: requestTimestamp,
            periodFrom: formatTimestamp(new Date(startDate)),
            periodTo: formatTimestamp(new Date(endDate)),
            vOpList: vOpList
        };

        if (format === "csv") {
            const csvFields = ["visitingOpID", "nPasses", "passesCost"];
            const json2csvParser = new Parser({ fields: csvFields });
            const csvData = json2csvParser.parse(vOpList);
            res.header("Content-Type", "text/csv");
            res.attachment(`chargesBy_${tollOpID}_${date_from}_${date_to}.csv`);
            return res.send(csvData);
        }

        res.json(response);

    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

module.exports = router;