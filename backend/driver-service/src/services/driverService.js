const crypto = require("crypto");

const driverRepository = require("../repositories/driverRepository");

const {
    DRIVER_STATUS,
    VEHICLE_TYPE,
} = require("../models/driverModel");

const VALID_STATUS_TRANSITIONS = {
    [DRIVER_STATUS.OFFLINE]: [
        DRIVER_STATUS.AVAILABLE,
    ],

    [DRIVER_STATUS.AVAILABLE]: [
        DRIVER_STATUS.BUSY,
        DRIVER_STATUS.OFFLINE,
    ],

    [DRIVER_STATUS.BUSY]: [
        DRIVER_STATUS.ON_DELIVERY,
        DRIVER_STATUS.AVAILABLE,
        DRIVER_STATUS.OFFLINE,
    ],

    [DRIVER_STATUS.ON_DELIVERY]: [
        DRIVER_STATUS.AVAILABLE,
        DRIVER_STATUS.OFFLINE,
    ],
};

function validateCreateDriver(data) {
    if (!data.name || typeof data.name !== "string") {
        throw new Error("name is required");
    }

    if (!data.phone || typeof data.phone !== "string") {
        throw new Error("phone is required");
    }

    if (!data.vehicleType) {
        throw new Error("vehicleType is required");
    }

    if (!Object.values(VEHICLE_TYPE).includes(data.vehicleType)) {
        throw new Error("Invalid vehicle type");
    }

    if (
        data.capacity !== undefined &&
        (!Number.isInteger(data.capacity) || data.capacity <= 0)
    ) {
        throw new Error("capacity must be a positive integer");
    }

    if (
        data.zoneId !== undefined &&
        data.zoneId !== null &&
        typeof data.zoneId !== "string"
    ) {
        throw new Error("zoneId must be a string");
    }
}

async function createDriver(data) {
    validateCreateDriver(data);

    const driver = {
        driverId: crypto.randomUUID(),
        name: data.name.trim(),
        phone: data.phone.trim(),
        vehicleType: data.vehicleType,
        capacity: data.capacity ?? 1,

        // New driver starts offline.
        // It must explicitly transition to AVAILABLE.
        status: DRIVER_STATUS.OFFLINE,

        zoneId: data.zoneId ?? null,
        lastHeartbeat: null,
    };

    return driverRepository.createDriver(driver);
}

async function getDriver(driverId) {
    const driver = await driverRepository.findById(driverId);

    if (!driver) {
        const error = new Error("Driver not found");
        error.statusCode = 404;
        throw error;
    }

    return driver;
}

async function getAllDrivers() {
    return driverRepository.findAll();
}

async function getAvailableDrivers() {
    return driverRepository.findAvailable();
}

async function updateDriverStatus(driverId, newStatus) {
    if (!Object.values(DRIVER_STATUS).includes(newStatus)) {
        const error = new Error("Invalid driver status");
        error.statusCode = 400;
        throw error;
    }

    const driver = await getDriver(driverId);

    const allowedTransitions =
        VALID_STATUS_TRANSITIONS[driver.status] || [];

    if (!allowedTransitions.includes(newStatus)) {
        const error = new Error(
            `Invalid status transition: ${driver.status} → ${newStatus}`
        );

        error.statusCode = 409;

        throw error;
    }

    return driverRepository.updateStatus(
        driverId,
        newStatus
    );
}

async function updateHeartbeat(driverId) {
    await getDriver(driverId);

    return driverRepository.updateHeartbeat(driverId);
}

module.exports = {
    createDriver,
    getDriver,
    getAllDrivers,
    getAvailableDrivers,
    updateDriverStatus,
    updateHeartbeat,
};