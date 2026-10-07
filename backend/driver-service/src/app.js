const express = require("express");
const cors = require("cors");

const driverRoutes = require("./routes/driverRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "driver-service",
        status: "UP",
    });
});

app.use("/drivers", driverRoutes);

app.use(errorHandler);

module.exports = app;