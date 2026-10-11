const orderClient = require("../clients/orderClient");
const driverClient = require("../clients/driverClient");

const {
    calculateDistanceKm,
} = require("../utils/distance");

const {
    redisClient,
    reserveDriver,
    releaseDriverReservation,
    addWaitingOrder,
    removeWaitingOrder,
} = require("../clients/redisClient");

async function dispatchOrder(orderId) {
    console.log(`Dispatching order ${orderId}...`);

    // --------------------------------------------------
    // 1. Get order
    // --------------------------------------------------

    let order;

    try {
        order = await orderClient.getOrder(orderId);
    } catch (error) {
        // A stale Kafka event for an already deleted/non-existent
        // order is not something we should retry forever.

        if (error.response?.status === 404) {
            console.warn(
                `Order ${orderId} no longer exists. Skipping stale event.`
            );

            return {
                status: "SKIPPED",
                reason: "ORDER_NOT_FOUND",
                orderId,
            };
        }

        throw error;
    }

    console.log(
        `Order ${orderId} current status: ${order.status}`
    );

    // --------------------------------------------------
    // 2. Idempotency
    // --------------------------------------------------

    if (order.status === "ASSIGNED") {
        console.log(
            `Order ${orderId} already assigned. Skipping duplicate event.`
        );

        return {
            status: "ALREADY_ASSIGNED",
            orderId,
        };
    }

    if (
        order.status !== "CREATED" &&
        order.status !== "SEARCHING_DRIVER"
    ) {
        console.log(
            `Order ${orderId} is in status ${order.status}. Skipping dispatch.`
        );

        return {
            status: "SKIPPED",
            reason: "INVALID_DISPATCH_STATUS",
            orderId,
        };
    }

    // --------------------------------------------------
    // 3. Get pickup zone
    // --------------------------------------------------

    const pickupZoneId = order.pickup_zone_id;

    if (!pickupZoneId) {
        const error = new Error(
            `Order ${orderId} does not have a pickup zone`
        );

        error.statusCode = 500;

        throw error;
    }

    console.log(
        `Order ${orderId} pickup zone: ${pickupZoneId}`
    );

    // --------------------------------------------------
    // 4. Move CREATED → SEARCHING_DRIVER
    // --------------------------------------------------

    if (order.status === "CREATED") {
        console.log(
            `Order ${orderId} → SEARCHING_DRIVER`
        );

        await orderClient.updateOrderStatus(
            orderId,
            "SEARCHING_DRIVER"
        );

        order.status = "SEARCHING_DRIVER";
    }

    // --------------------------------------------------
    // 5. Get available drivers from this zone
    // --------------------------------------------------

    const availableDriverIds =
        await redisClient.sMembers(
            `drivers:available:${pickupZoneId}`
        );

    console.log(
        `Found ${availableDriverIds.length} available drivers in zone ${pickupZoneId}`
    );

    // --------------------------------------------------
    // 6. No driver in zone
    //
    // IMPORTANT:
    // This is NOT an error.
    // Do not throw 409.
    // Do not make Kafka retry the same event.
    // --------------------------------------------------

    if (availableDriverIds.length === 0) {
        console.warn(
            `No available drivers in zone ${pickupZoneId} for order ${orderId}`
        );

        await addWaitingOrder(
            orderId,
            pickupZoneId
        );

        return {
            status: "WAITING_FOR_DRIVER",
            reason: "NO_DRIVER_IN_ZONE",
            orderId,
            zoneId: pickupZoneId,
        };
    }

    // --------------------------------------------------
    // 7. Find nearest valid driver
    // --------------------------------------------------

    let nearestDriver = null;
    let nearestDistance = Infinity;

    for (const driverId of availableDriverIds) {
        // ----------------------------------------------
        // Verify current driver state
        // ----------------------------------------------

        const driverKey = `driver:${driverId}`;

        const driverState =
            await redisClient.hGetAll(driverKey);

        if (
            !driverState ||
            driverState.status !== "AVAILABLE"
        ) {
            console.warn(
                `Skipping driver ${driverId}: Redis status is ${driverState.status || "UNKNOWN"}`
            );

            continue;
        }

        // ----------------------------------------------
        // Get latest cached location
        // ----------------------------------------------

        const locationKey =
            `driver:location:${driverId}`;

        const location =
            await redisClient.hGetAll(locationKey);

        if (
            !location ||
            !location.latitude ||
            !location.longitude
        ) {
            console.warn(
                `No cached location for driver ${driverId}`
            );

            continue;
        }

        // ----------------------------------------------
        // Verify location belongs to the order zone
        // ----------------------------------------------

        if (
            location.zoneId &&
            location.zoneId !== pickupZoneId
        ) {
            console.warn(
                `Skipping driver ${driverId}: location zone ${location.zoneId} does not match order zone ${pickupZoneId}`
            );

            continue;
        }

        // ----------------------------------------------
        // Validate coordinates
        // ----------------------------------------------

        const driverLatitude =
            Number(location.latitude);

        const driverLongitude =
            Number(location.longitude);

        const pickupLatitude =
            Number(order.pickup_latitude);

        const pickupLongitude =
            Number(order.pickup_longitude);

        if (
            !Number.isFinite(driverLatitude) ||
            !Number.isFinite(driverLongitude) ||
            !Number.isFinite(pickupLatitude) ||
            !Number.isFinite(pickupLongitude)
        ) {
            console.warn(
                `Skipping driver ${driverId}: invalid coordinates`
            );

            continue;
        }

        // ----------------------------------------------
        // Calculate distance
        // ----------------------------------------------

        const distance =
            calculateDistanceKm(
                pickupLatitude,
                pickupLongitude,
                driverLatitude,
                driverLongitude
            );

        console.log(
            `Driver ${driverId} distance: ${distance.toFixed(3)} km`
        );

        if (distance < nearestDistance) {
            nearestDistance = distance;

            nearestDriver = {
                driverId,
                distance,
            };
        }
    }

    // --------------------------------------------------
    // 8. No driver with valid location
    //
    // Again: business condition, NOT Kafka failure.
    // --------------------------------------------------

    if (!nearestDriver) {
        console.warn(
            `No drivers with valid cached locations in zone ${pickupZoneId} for order ${orderId}`
        );

        await addWaitingOrder(
            orderId,
            pickupZoneId
        );

        return {
            status: "WAITING_FOR_DRIVER",
            reason: "NO_VALID_DRIVER_LOCATION",
            orderId,
            zoneId: pickupZoneId,
        };
    }

    console.log(
        `Selected driver ${nearestDriver.driverId} for order ${orderId} (${nearestDriver.distance.toFixed(3)} km)`
    );

    // --------------------------------------------------
    // 9. Reserve driver
    // --------------------------------------------------

    const reservationAcquired =
        await reserveDriver(
            nearestDriver.driverId,
            orderId,
            30
        );

    if (!reservationAcquired) {
        console.warn(
            `Driver ${nearestDriver.driverId} was reserved by another order. Searching for another driver.`
        );

        await addWaitingOrder(
            orderId,
            pickupZoneId
        );

        return {
            status: "WAITING_FOR_DRIVER",
            reason: "DRIVER_RESERVATION_FAILED",
            orderId,
            zoneId: pickupZoneId,
        };
    }

    console.log(
        `🔒 Driver ${nearestDriver.driverId} reserved for order ${orderId}`
    );

    try {
        console.log(
            `Driver ${nearestDriver.driverId} → BUSY`
        );

        await driverClient.updateDriverStatus(
            nearestDriver.driverId,
            "BUSY"
        );

        // --------------------------------------------------
        // 10. Assign order
        // --------------------------------------------------

        console.log(
            `Order ${orderId} → ASSIGNED`
        );

        await orderClient.updateOrderStatus(
            orderId,
            "ASSIGNED"
        );

        console.log(
            `✅ Order ${orderId} assigned to driver ${nearestDriver.driverId}`
        );

        await releaseDriverReservation(
            nearestDriver.driverId,
            orderId
        );

        console.log(
            `🔓 Driver reservation released for ${nearestDriver.driverId}`
        );

        return {
            status: "ASSIGNED",
            orderId,
            driverId: nearestDriver.driverId,
            distanceKm: nearestDriver.distance,
        };
    } catch (error) {
        // --------------------------------------------------
        // 11. Compensation
        //
        // If driver became BUSY but order assignment failed,
        // release the reservation and driver back to AVAILABLE.
        // --------------------------------------------------

        console.error(
            `Assignment failed for order ${orderId}:`,
            error.message
        );

        try {
            await releaseDriverReservation(
                nearestDriver.driverId,
                orderId
            );

            const latestOrder =
                await orderClient.getOrder(orderId);

            if (latestOrder.status !== "ASSIGNED") {
                console.warn(
                    `Releasing driver ${nearestDriver.driverId} back to AVAILABLE`
                );

                await driverClient.updateDriverStatus(
                    nearestDriver.driverId,
                    "AVAILABLE"
                );
            } else {
                console.log(
                    `Order ${orderId} is already ASSIGNED. Keeping driver BUSY.`
                );
            }
        } catch (compensationError) {
            console.error(
                `Failed to compensate driver ${nearestDriver.driverId}:`,
                compensationError.message
            );
        }

        throw error;
    }
}

module.exports = {
    dispatchOrder,
};