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

// GET /tollStationPasses/:tollStationID/:date_from/:date_to
router.get("/tollStationPasses/:tollStationID?/:date_from?/:date_to?", async (req, res) => {
    const { tollStationID, date_from, date_to } = req.params;
    const format = req.query.format || "json";
    const requestTimestamp = formatTimestamp(new Date());

    // Validate input
    if (!tollStationID || !date_from || !date_to) {
        return res.status(400).json({ error: "Bad Request", message: "Missing required parameters." });
    }

    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(date_from) || !dateRegex.test(date_to)) {
        return res.status(400).json({ error: "Bad Request", message: "Invalid date format. Use YYYYMMDD." });
    }

    const startDate = `${date_from.substring(0,4)}-${date_from.substring(4,6)}-${date_from.substring(6,8)} 00:00:00`;
    const endDate = `${date_to.substring(0,4)}-${date_to.substring(4,6)}-${date_to.substring(6,8)} 23:59:59`;

    try {
        // Validate tollStationID
        const [stationCheck] = await pool.query(
            `SELECT station_id FROM tollstations WHERE station_id = ?`,
            [tollStationID]
        );

        if (stationCheck.length === 0) {
            return res.status(400).json({ error: "Bad Parameter", message: "Toll station ID is invalid." });
        }

        const [results] = await pool.query(
            `SELECT p.pass_id, p.timestamp, p.tag_id, 
                    t.company_id AS stationOperator, 
                    v.company_id AS tagProvider, 
                    p.pass_type, p.charge 
             FROM passes p
             JOIN tollstations t ON p.station_id = t.station_id
             JOIN vehicletags v ON p.tag_id = v.tag_id
             WHERE p.station_id = ? 
             AND p.timestamp BETWEEN ? AND ?
             ORDER BY p.timestamp ASC`,
            [tollStationID, startDate, endDate]
        );

        if (results.length === 0) {
            return res.status(204).send();
        }

        const passList = results.map((row, index) => ({
            passIndex: index + 1,
            passID: row.pass_id,
            timestamp: formatTimestamp(row.timestamp),
            tagID: row.tag_id,
            tagProvider: row.tagProvider || "Unknown",
            passType: row.pass_type,
            passCharge: parseFloat(row.charge)
        }));

        const response = {
            stationID: tollStationID,
            stationOperator: results[0].stationOperator || "Unknown",
            requestTimestamp: requestTimestamp,
            periodFrom: formatTimestamp(new Date(startDate)),
            periodTo: formatTimestamp(new Date(endDate)),
            nPasses: results.length,
            passList: passList
        };

        if (format === "csv") {
            const json2csvParser = new Parser();
            const csvData = json2csvParser.parse(passList);
            res.header("Content-Type", "text/csv");
            res.attachment("tollStationPasses.csv");
            return res.send(csvData);
        }

        res.json(response);

    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

module.exports = router;