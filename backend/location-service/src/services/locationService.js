const locationRepository = require("../repositories/locationRepository");

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
    validateLocation(data);

    return locationRepository.upsertLocation(data);
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