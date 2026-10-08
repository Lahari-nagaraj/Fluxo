const locationRepository = require("../repositories/locationRepository");
const { redisClient } = require("../clients/redisClient");
const { getZoneId } = require("../../utils/zone");

function createValidationError(message) {
    const error = new Error(message);

    error.statusCode = 400;

    return error;
}

function validateLocation(data) {
    if (!data.driverId) {
        throw createValidationError(
            "driverId is required"
        );
    }

    if (
        typeof data.latitude !== "number" ||
        typeof data.longitude !== "number"
    ) {
        throw createValidationError(
            "latitude and longitude must be numbers"
        );
    }

    if (
        data.latitude < -90 ||
        data.latitude > 90
    ) {
        throw createValidationError(
            "latitude must be between -90 and 90"
        );
    }

    if (
        data.longitude < -180 ||
        data.longitude > 180
    ) {
        throw createValidationError(
            "longitude must be between -180 and 180"
        );
    }

    if (
        data.zoneId !== undefined &&
        data.zoneId !== null &&
        typeof data.zoneId !== "string"
    ) {
        throw createValidationError(
            "zoneId must be a string"
        );
    }
}

async function updateLocation(data) {
    // 1. Validate location data
    validateLocation(data);

    // 2. Update PostgreSQL
    const location =
        await locationRepository.upsertLocation(
            data
        );

    // 3. Calculate zone from the latest coordinates
    const zoneId = getZoneId(
        data.latitude,
        data.longitude
    );

    const driverKey =
        `driver:${data.driverId}`;

    const driverState =
        await redisClient.hGetAll(driverKey);

    const oldZoneId =
        driverState.zoneId;

    // 4. Update Redis with latest driver location
    const locationKey =
        `driver:location:${data.driverId}`;

    await redisClient.hSet(locationKey, {
        latitude: String(data.latitude),
        longitude: String(data.longitude),
        zoneId,
        updatedAt: new Date().toISOString(),
    });

    // 5. Location becomes stale if no new update
    //    is received within 60 seconds.
    await redisClient.expire(
        locationKey,
        60
    );

    if (
        driverState.status === "AVAILABLE" &&
        oldZoneId &&
        oldZoneId !== zoneId
    ) {
        await redisClient.sRem(
            `drivers:available:${oldZoneId}`,
            data.driverId
        );
    }

    if (driverState.status === "AVAILABLE") {
        await redisClient.sAdd(
            `drivers:available:${zoneId}`,
            data.driverId
        );
    }

    await redisClient.hSet(driverKey, {
        driverId: data.driverId,
        zoneId,
    });

    // 6. Return the database result
    return location;
}

async function getDriverLocation(driverId) {
    const location =
        await locationRepository.findByDriverId(
            driverId
        );

    if (!location) {
        const error = new Error(
            "Location not found for driver"
        );

        error.statusCode = 404;

        throw error;
    }

    return location;
}

async function getNearbyDrivers(
    latitude,
    longitude,
    radiusKm
) {
    if (
        typeof latitude !== "number" ||
        typeof longitude !== "number"
    ) {
        const error = new Error(
            "latitude and longitude must be numbers"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        latitude < -90 ||
        latitude > 90
    ) {
        const error = new Error(
            "latitude must be between -90 and 90"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        longitude < -180 ||
        longitude > 180
    ) {
        const error = new Error(
            "longitude must be between -180 and 180"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        typeof radiusKm !== "number" ||
        radiusKm <= 0 ||
        radiusKm > 100
    ) {
        const error = new Error(
            "radiusKm must be between 0 and 100"
        );

        error.statusCode = 400;

        throw error;
    }

    return locationRepository.findNearby(
        latitude,
        longitude,
        radiusKm
    );
}

module.exports = {
    updateLocation,
    getDriverLocation,
    getNearbyDrivers,
};