require("dotenv").config();

module.exports = {
    port: process.env.PORT || 3004,

    driverServiceUrl:
        process.env.DRIVER_SERVICE_URL || "http://localhost:3002",

    locationServiceUrl:
        process.env.LOCATION_SERVICE_URL || "http://localhost:3003",

    orderServiceUrl:
        process.env.ORDER_SERVICE_URL || "http://localhost:3001",
};