const locationClient = require("../clients/locationClient");
const orderClient = require("../clients/orderClient");
const driverClient = require("../clients/driverClient");

const { calculateDistanceKm } = require("../utils/distance");
const { redisClient } = require("../clients/redisClient");

async function dispatchOrder(orderId) {
    console.log(`Dispatching order: ${orderId}`);

    // 1. Get order
    let order;

    try {
        order = await orderClient.getOrder(orderId);
    } catch (error) {
        // The Kafka event may refer to an order that no longer exists.
        // Do not retry such stale events forever.
        if (error.response?.status === 404) {
            console.warn(
                `⚠️ Order ${orderId} no longer exists. Skipping stale event.`
            );

            return {
                order_id: orderId,
                status: "NOT_FOUND",
                skipped: true,
            };
        }

        throw error;
    }

    if (!order) {
        console.warn(
            `⚠️ Order ${orderId} was not found. Skipping event.`
        );

        return {
            order_id: orderId,
            status: "NOT_FOUND",
            skipped: true,
        };
    }

    console.log(
        `Order ${orderId} current status: ${order.status}`
    );

    // 2. Validate order status
    // Idempotency: if this event is delivered again after
    // the order has already been assigned, do nothing.
    if (order.status === "ASSIGNED") {
        console.log(
            `⏭️ Order ${orderId} already assigned. Skipping duplicate event.`
        );

        return {
            order_id: orderId,
            status: "ASSIGNED",
            alreadyProcessed: true,
        };
    }

    if (
        order.status !== "CREATED" &&
        order.status !== "SEARCHING_DRIVER"
    ) {
        throw new Error(
            `Order cannot be dispatched from status ${order.status}`
        );
    }

    // 3. Change order status to SEARCHING_DRIVER
    if (order.status === "CREATED") {
        await orderClient.updateOrderStatus(
            orderId,
            "SEARCHING_DRIVER"
        );

        console.log(
            `Order ${orderId} → SEARCHING_DRIVER`
        );
    }

    // 4. Get available drivers from Redis
    const driverIds =
        await redisClient.sMembers("drivers:available");

    if (!driverIds || driverIds.length === 0) {
        const error = new Error(
            "No available drivers"
        );

        error.statusCode = 409;
        throw error;
    }

    console.log(
        `Found ${driverIds.length} available drivers in Redis`
    );

    // 5. Find closest driver using cached locations
    let bestDriver = null;
    let shortestDistance = Infinity;

    for (const driverId of driverIds) {
        try {
            const location =
                await redisClient.hGetAll(
                    `driver:location:${driverId}`
                );

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

            const distance = calculateDistanceKm(
                Number(location.latitude),
                Number(location.longitude),
                Number(order.pickup_latitude),
                Number(order.pickup_longitude)
            );

            console.log(
                `Driver ${driverId}: ${distance.toFixed(3)} km`
            );

            if (distance < shortestDistance) {
                shortestDistance = distance;

                bestDriver = {
                    driver: {
                        driver_id: driverId,
                    },
                    location,
                    distance,
                };
            }
        } catch (error) {
            console.error(
                `Failed to get cached location for driver ${driverId}:`,
                error.message
            );

            // Skip this driver and continue checking others.
            continue;
        }
    }

    // 6. Make sure we found a driver with a valid location
    if (!bestDriver) {
        const error = new Error(
            "No drivers with valid locations available"
        );

        error.statusCode = 409;
        throw error;
    }

    console.log(
        `Closest driver: ${bestDriver.driver.driver_id} ` +
        `(${bestDriver.distance.toFixed(3)} km)`
    );

    // 7. Mark driver as BUSY
    // Driver Service remains responsible for the actual
    // status transition and persistence.
    await driverClient.updateDriverStatus(
        bestDriver.driver.driver_id,
        "BUSY"
    );

    console.log(
        `Driver ${bestDriver.driver.driver_id} → BUSY`
    );

    // 8. Mark order as ASSIGNED
    const updatedOrder =
        await orderClient.updateOrderStatus(
            orderId,
            "ASSIGNED"
        );

    console.log(
        `Order ${orderId} → ASSIGNED`
    );

    // 9. Return dispatch result
    return {
        order: updatedOrder,
        driver: bestDriver.driver,
        distanceKm: Number(
            bestDriver.distance.toFixed(3)
        ),
    };
}

module.exports = {
    dispatchOrder,
};