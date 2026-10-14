
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

module.exports = {
    port: Number(process.env.PORT) || 3004,

    driverServiceUrl:
        process.env.DRIVER_SERVICE_URL ||
        (isProduction ? "https://fluxo-driver-service.onrender.com" : "http://localhost:3002"),

    locationServiceUrl:
        process.env.LOCATION_SERVICE_URL ||
        (isProduction ? "https://fluxo-location-service.onrender.com" : "http://localhost:3003"),

    orderServiceUrl:
        process.env.ORDER_SERVICE_URL ||
        (isProduction ? "https://fluxo-order-service.onrender.com" : "http://localhost:3001"),

    simulationMinuteMs:
        Number(process.env.SIMULATION_MINUTE_MS) || 5000,
};
