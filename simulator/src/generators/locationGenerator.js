const config = require("../config");
const locationApi = require("../api/locationApi");

function randomMovement() {
    return (Math.random() - 0.5) * 0.002;
}

function startLocationSimulation(drivers) {
    setInterval(async () => {
        for (const driver of drivers) {
            if (driver.status !== "AVAILABLE") {
                continue;
            }

            driver.latitude += randomMovement();
            driver.longitude += randomMovement();

            driver.latitude = Math.max(
                config.minLatitude,
                Math.min(
                    config.maxLatitude,
                    driver.latitude
                )
            );

            driver.longitude = Math.max(
                config.minLongitude,
                Math.min(
                    config.maxLongitude,
                    driver.longitude
                )
            );

            try {
                await locationApi.updateLocation({
                    driverId: driver.driverId,
                    latitude: driver.latitude,
                    longitude: driver.longitude,
                    zoneId: "ZONE_A",
                });

                console.log(
                    `📍 Driver ${driver.driverId} moved → ` +
                    `${driver.latitude.toFixed(5)}, ` +
                    `${driver.longitude.toFixed(5)}`
                );
            } catch (error) {
                console.error(
                    `Location update failed for ${driver.driverId}:`,
                    error.response?.data ||
                    error.message
                );
            }
        }
    }, config.locationUpdateIntervalMs);
}

module.exports = {
    startLocationSimulation,
};