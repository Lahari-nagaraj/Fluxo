require("dotenv").config();

module.exports = {
    driverServiceUrl:
        process.env.DRIVER_SERVICE_URL,

    locationServiceUrl:
        process.env.LOCATION_SERVICE_URL,

    orderServiceUrl:
        process.env.ORDER_SERVICE_URL,

    dispatchServiceUrl:
        process.env.DISPATCH_SERVICE_URL,

    numberOfDrivers:
        Number(process.env.NUMBER_OF_DRIVERS || 10),

    orderIntervalMs:
        Number(process.env.ORDER_INTERVAL_MS || 5000),

    locationUpdateIntervalMs:
        Number(
            process.env.LOCATION_UPDATE_INTERVAL_MS || 3000
        ),

    minLatitude:
        Number(process.env.MIN_LATITUDE || 12.9),

    maxLatitude:
        Number(process.env.MAX_LATITUDE || 13.05),

    minLongitude:
        Number(process.env.MIN_LONGITUDE || 77.5),

    maxLongitude:
        Number(process.env.MAX_LONGITUDE || 77.7),
};