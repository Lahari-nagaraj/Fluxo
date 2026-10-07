const express = require("express");

const {
    updateLocation,
    getDriverLocation,
    getNearbyDrivers,
} = require("../controllers/locationController");

const router = express.Router();

router.post("/", updateLocation);

router.get("/nearby", getNearbyDrivers);

router.get("/:driverId", getDriverLocation);

module.exports = router;