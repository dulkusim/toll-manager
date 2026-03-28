require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./utils/db.config');

// Import routes
const tollStationPassesRoutes = require("./routes/tollStationPasses");
const passAnalysisRoutes = require("./routes/passAnalysis");
const passesCostRoutes = require("./routes/passesCost");
const chargesByRoutes = require("./routes/chargesBy");
const netChargesRoutes = require("./routes/netCharges");
const healthcheckRoutes = require("./routes/healthcheck");
const resetStationsRoutes = require("./routes/resetStations");
const resetPassesRoutes = require("./routes/resetPasses");
const addPassesRoutes = require("./routes/addPasses");
const operatorsRouter = require("./routes/operators");
const mapStationsRoutes = require("./routes/mapStations");
const loginRoutes = require("./routes/login");
const logoutRoutes = require("./routes/logout");
const stationRoutes = require("./routes/station");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Required for /login form-encoded body
app.use(cors());

// API routes
app.use("/api", tollStationPassesRoutes);
app.use("/api", passAnalysisRoutes);
app.use("/api", passesCostRoutes);
app.use("/api", chargesByRoutes);
app.use("/api", netChargesRoutes);
app.use("/api", healthcheckRoutes);
app.use("/api", resetStationsRoutes);
app.use("/api", resetPassesRoutes);
app.use("/api", addPassesRoutes);
app.use("/api", operatorsRouter);
app.use("/api", mapStationsRoutes);
app.use("/api", loginRoutes);
app.use("/api", logoutRoutes);
app.use("/api", stationRoutes);

// Default route
app.get('/', (req, res) => {
    res.send("Hello World! This is the back-end server.");
});

// Catch-all for invalid endpoints
app.use((req, res) => {
    res.status(500).json({ error: "Internal Server Error", message: "The requested endpoint doesn't exist." });
});

module.exports = app;