const config = require("../config");
const driverApi = require("../api/driverApi");
const locationApi = require("../api/locationApi");

const RUN_ID = Date.now().toString().slice(-6);

function randomNumber(min, max) {
    return Math.random() * (max - min) + min;
}

function randomVehicleType() {
    const vehicles = [
        "BIKE",
        "SCOOTER",
        "CAR",
        "VAN",
    ];

    return vehicles[
        Math.floor(Math.random() * vehicles.length)
    ];
}

async function generateDrivers() {
    const drivers = [];

    for (
        let i = 1;
        i <= config.numberOfDrivers;
        i++
    ) {
        const driver = await driverApi.createDriver({
            name: `SimDriver-${RUN_ID}-${i}`,
            phone: `9${RUN_ID}${String(i).padStart(3, "0")}`,
            vehicleType: randomVehicleType(),
            capacity: 2,
            zoneId: "ZONE_A",
        });

        await driverApi.updateDriverStatus(
            driver.driver_id,
            "AVAILABLE"
        );

        const location = {
            driverId: driver.driver_id,
            latitude: randomNumber(
                config.minLatitude,
                config.maxLatitude
            ),
            longitude: randomNumber(
                config.minLongitude,
                config.maxLongitude
            ),
            zoneId: "ZONE_A",
        };

        await locationApi.updateLocation(location);

        drivers.push({
            driverId: driver.driver_id,
            latitude: location.latitude,
            longitude: location.longitude,
            status: "AVAILABLE",
        });

        console.log(
            `🚚 Created driver ${i}: ${driver.driver_id}`
        );
    }

    return drivers;
}

module.exports = {
    generateDrivers,
};