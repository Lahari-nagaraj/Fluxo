const express = require("express");
const cors = require("cors");

const dispatchRoutes = require("./routes/dispatchRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "dispatch-service",
        status: "UP",
    });
});

app.use("/dispatch", dispatchRoutes);

app.use(errorHandler);

module.exports = app;