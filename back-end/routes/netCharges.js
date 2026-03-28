const express = require("express");
const router = express.Router();
const pool = require("../utils/db.config");
const { Parser } = require("json2csv");
const verifyToken = require("../middleware/authMiddleware");

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

// GET /netCharges/:tollOpID1/:tollOpID2/:date_from/:date_to
router.get("/netCharges/:tollOpID1?/:tollOpID2?/:date_from?/:date_to?", verifyToken, async (req, res) => {
    const { tollOpID1, tollOpID2, date_from, date_to } = req.params;
    const { format = "json" } = req.query;
    const requestTimestamp = formatTimestamp(new Date());

    if (!tollOpID1 || !tollOpID2 || !date_from || !date_to) {
        return res.status(400).json({ error: "Bad Request", message: "Missing required parameters." });
    }

    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(date_from) || !dateRegex.test(date_to)) {
        return res.status(400).json({ error: "Bad Request", message: "Invalid date format. Use YYYYMMDD." });
    }

    const startDate = `${date_from.substring(0, 4)}-${date_from.substring(4, 6)}-${date_from.substring(6, 8)} 00:00:00`;
    const endDate = `${date_to.substring(0, 4)}-${date_to.substring(4, 6)}-${date_to.substring(6, 8)} 23:59:59`;

    try {
        // Charges owed by tollOpID2 to tollOpID1
        const [resultOp2] = await pool.query(
            `SELECT SUM(p.charge) AS passesCostOpID2
             FROM passes p
             JOIN tollstations t ON p.station_id = t.station_id
             JOIN vehicletags v ON p.tag_id = v.tag_id
             WHERE t.company_id = ? 
             AND v.company_id = ? 
             AND p.timestamp BETWEEN ? AND ?`,
            [tollOpID1, tollOpID2, startDate, endDate]
        );

        // Charges owed by tollOpID1 to tollOpID2
        const [resultOp1] = await pool.query(
            `SELECT SUM(p.charge) AS passesCostOpID1
             FROM passes p
             JOIN tollstations t ON p.station_id = t.station_id
             JOIN vehicletags v ON p.tag_id = v.tag_id
             WHERE t.company_id = ? 
             AND v.company_id = ? 
             AND p.timestamp BETWEEN ? AND ?`,
            [tollOpID2, tollOpID1, startDate, endDate]
        );

        const passesCostOpID2 = parseFloat(resultOp2[0]?.passesCostOpID2) || 0.0;
        const passesCostOpID1 = parseFloat(resultOp1[0]?.passesCostOpID1) || 0.0;
        const netCharges = parseFloat((passesCostOpID2 - passesCostOpID1).toFixed(2));

        if (passesCostOpID2 === 0 && passesCostOpID1 === 0) {
            return res.status(204).send();
        }

        const response = {
            tollOpID1: tollOpID1,
            tollOpID2: tollOpID2,
            requestTimestamp: requestTimestamp,
            periodFrom: formatTimestamp(new Date(startDate)),
            periodTo: formatTimestamp(new Date(endDate)),
            passesCostOpID2: passesCostOpID2,
            passesCostOpID1: passesCostOpID1,
            netCharges: netCharges
        };

        if (format === "csv") {
            const csvFields = ["tollOpID1", "tollOpID2", "requestTimestamp", "periodFrom", "periodTo", "passesCostOpID2", "passesCostOpID1", "netCharges"];
            const json2csvParser = new Parser({ fields: csvFields });
            const csvData = json2csvParser.parse([response]);
            res.header("Content-Type", "text/csv");
            res.attachment(`netCharges_${tollOpID1}_${tollOpID2}_${date_from}_${date_to}.csv`);
            return res.send(csvData);
        }

        res.json(response);

    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

module.exports = router;