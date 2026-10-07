const express = require("express");
const cors = require("cors");

const orderRoutes = require("./routes/orderRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "order-service",
        status: "UP",
    });
});

app.use("/orders", orderRoutes);

app.use(errorHandler);

module.exports = app;