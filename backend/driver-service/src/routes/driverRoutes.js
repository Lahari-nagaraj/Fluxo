const express = require("express");

const {
    createDriver,
    getDriver,
    getAllDrivers,
    getAvailableDrivers,
    updateDriverStatus,
    updateHeartbeat,
} = require("../controllers/driverController");

const router = express.Router();

router.post("/", createDriver);

router.get("/", getAllDrivers);

router.get("/available", getAvailableDrivers);

router.get("/:id", getDriver);

router.patch("/:id/status", updateDriverStatus);

router.patch("/:id/heartbeat", updateHeartbeat);

module.exports = router;