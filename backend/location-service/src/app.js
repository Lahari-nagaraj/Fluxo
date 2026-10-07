const express = require("express");
const cors = require("cors");

const locationRoutes =
    require("./routes/locationRoutes");

const errorHandler =
    require("./middleware/errorHandler");

const app = express();

app.use(cors());

app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "location-service",
        status: "UP",
    });
});

app.use("/locations", locationRoutes);

app.use(errorHandler);

module.exports = app;