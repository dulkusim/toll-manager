const express = require("express");
const router = express.Router();
const pool = require("../utils/db.config");
const { Parser } = require("json2csv");

// GET /mapStations - Retrieve all toll stations with company and location
router.get("/mapStations", async (req, res) => {
    const format = req.query.format || "json";

    try {
        const [results] = await pool.query(
            `SELECT station_id, company_id, latitude, longitude, station_name, road, locality, price1, price2, price3, price4
             FROM tollstations 
             ORDER BY station_id ASC`
        );

        if (results.length === 0) {
            return res.status(204).send();
        }

        const response = results.map(row => ({
            stationID: row.station_id,
            companyID: row.company_id,
            stationName: row.station_name,
            stationRoad: row.road,
            stationLocality: row.locality,
            stationPriceCar: row.price2,
            stationPriceBike: row.price1,
            stationPriceTruck: row.price3,
            stationPriceBus: row.price4,
            location: { lat: parseFloat(row.latitude), lng: parseFloat(row.longitude) }
        }));

        if (format === "csv") {
            const json2csvParser = new Parser();
            const csvData = json2csvParser.parse(response);
            res.header("Content-Type", "text/csv");
            res.attachment("mapStations.csv");
            return res.send(csvData);
        }

        res.json(response);

    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// GET /mapStations/:operatorID - Retrieve toll stations filtered by operator
router.get("/mapStations/:operatorID?", async (req, res) => {
    const { operatorID } = req.params;
    const format = req.query.format || "json";

    try {
        const [results] = await pool.query(
            `SELECT station_id, company_id, latitude, longitude, station_name, road, locality, price1, price2, price3, price4
             FROM tollstations 
             WHERE company_id = ? 
             ORDER BY station_id ASC`,
            [operatorID]
        );

        if (results.length === 0) {
            return res.status(204).send();
        }

        const response = results.map(row => ({
            stationID: row.station_id,
            companyID: row.company_id,
            stationName: row.station_name,
            stationRoad: row.road,
            stationLocality: row.locality,
            stationPriceCar: row.price2,
            stationPriceBike: row.price1,
            stationPriceTruck: row.price3,
            stationPriceBus: row.price4,
            location: { lat: parseFloat(row.latitude), lng: parseFloat(row.longitude) }
        }));

        if (format === "csv") {
            const json2csvParser = new Parser();
            const csvData = json2csvParser.parse(response);
            res.header("Content-Type", "text/csv");
            res.attachment(`mapStations_${operatorID}.csv`);
            return res.send(csvData);
        }

        res.json(response);

    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

module.exports = router;