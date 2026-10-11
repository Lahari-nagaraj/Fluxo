
const crypto = require("crypto");

const {
    redisClient,
} = require("../clients/redisClient");

const driverRepository = require("../repositories/driverRepository");

const {
    DRIVER_STATUS,
    VEHICLE_TYPE,
} = require("../models/driverModel");

const {
    publishDriverAvailable,
} = require("../config/kafka");

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

    if (
        !Object.values(VEHICLE_TYPE).includes(
            data.vehicleType
        )
    ) {
        throw new Error("Invalid vehicle type");
    }

    if (
        data.capacity !== undefined &&
        (!Number.isInteger(data.capacity) ||
            data.capacity <= 0)
    ) {
        throw new Error(
            "capacity must be a positive integer"
        );
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
    const driver =
        await driverRepository.findById(driverId);

    if (!driver) {
        const error = new Error(
            "Driver not found"
        );

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

async function updateDriverStatus(
    driverId,
    newStatus
) {
    // 1. Validate new status
    if (
        !Object.values(DRIVER_STATUS).includes(
            newStatus
        )
    ) {
        const error = new Error(
            "Invalid driver status"
        );

        error.statusCode = 400;

        throw error;
    }

    // 2. Get existing driver
    const driver =
        await getDriver(driverId);

    // 3. Validate status transition
    const allowedTransitions =
        VALID_STATUS_TRANSITIONS[
            driver.status
        ] || [];

    if (
        !allowedTransitions.includes(
            newStatus
        )
    ) {
        const error = new Error(
            `Invalid status transition: ${driver.status} → ${newStatus}`
        );

        error.statusCode = 409;

        throw error;
    }

    // 4. Update PostgreSQL first
    const updatedDriver =
        await driverRepository.updateStatus(
            driverId,
            newStatus
        );

    const driverKey =
        `driver:${driverId}`;

    const previousDriverState =
        await redisClient.hGetAll(driverKey);

    const locationKey =
        `driver:location:${driverId}`;

    const location =
        await redisClient.hGetAll(locationKey);

    // Determine the active zone for this driver
    const zoneId =
        location.zoneId ||
        previousDriverState.zoneId ||
        updatedDriver.zone_id ||
        "";

    // 5. Update Redis driver state
    await redisClient.hSet(driverKey, {
        driverId,
        status: newStatus,
        updatedAt:
            new Date().toISOString(),
        zoneId: zoneId || "",
    });

    // 6. Maintain global available-driver set
    if (
        newStatus === DRIVER_STATUS.AVAILABLE
    ) {
        await redisClient.sAdd(
            "drivers:available",
            driverId
        );
    } else {
        await redisClient.sRem(
            "drivers:available",
            driverId
        );
    }

    // 7. Maintain zone-specific available-driver sets
    const knownZones = new Set([
        previousDriverState.zoneId,
        updatedDriver.zone_id,
        location.zoneId,
        zoneId,
    ].filter(Boolean));

    if (
        newStatus === DRIVER_STATUS.AVAILABLE
    ) {
        if (zoneId) {
            await redisClient.sAdd(
                `drivers:available:${zoneId}`,
                driverId
            );
        }

        // Clean up from any previous zones the driver is no longer in
        for (const knownZoneId of knownZones) {
            if (knownZoneId !== zoneId) {
                await redisClient.sRem(
                    `drivers:available:${knownZoneId}`,
                    driverId
                );
            }
        }
    } else {
        // Driver is no longer available (BUSY, OFFLINE) -> remove from all zone sets
        for (const knownZoneId of knownZones) {
            await redisClient.sRem(
                `drivers:available:${knownZoneId}`,
                driverId
            );
        }
    }

    // 8. Publish DriverAvailable event to Kafka
    if (
        newStatus === DRIVER_STATUS.AVAILABLE
    ) {
        await publishDriverAvailable(
            {
                ...updatedDriver,
                zone_id: zoneId || null,
            }
        );
    }

    // 9. Return updated driver
    return updatedDriver;
}

async function updateHeartbeat(driverId) {
    await getDriver(driverId);

    return driverRepository.updateHeartbeat(
        driverId
    );
}

async function syncAvailableDrivers() {
    try {
        const availableDrivers = await driverRepository.findAvailable();
        for (const driver of availableDrivers) {
            await redisClient.sAdd("drivers:available", driver.driver_id);
            await redisClient.hSet(`driver:${driver.driver_id}`, {
                driverId: driver.driver_id,
                status: DRIVER_STATUS.AVAILABLE,
                zoneId: driver.zone_id || "",
                updatedAt: new Date().toISOString(),
            });
            if (driver.zone_id) {
                await redisClient.sAdd(
                    `drivers:available:${driver.zone_id}`,
                    driver.driver_id
                );
            }
        }
        console.log(
            `✅ Synced ${availableDrivers.length} available drivers to Redis`
        );
        return availableDrivers;
    } catch (error) {
        console.error(
            "Failed to sync available drivers to Redis:",
            error.message
        );
    }
}

module.exports = {
    createDriver,
    getDriver,
    getAllDrivers,
    getAvailableDrivers,
    updateDriverStatus,
    updateHeartbeat,
    syncAvailableDrivers,
};

