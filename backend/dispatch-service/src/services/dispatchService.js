const driverClient = require("../clients/driverClient");
const locationClient = require("../clients/locationClient");
const orderClient = require("../clients/orderClient");
const { calculateDistanceKm } = require("../utils/distance");

async function dispatchOrder(orderId) {
    // 1. Get order
    const order = await orderClient.getOrder(orderId);

    if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
    }

    if (
        order.status !== "CREATED" &&
        order.status !== "SEARCHING_DRIVER"
    ) {
        const error = new Error(
            `Order cannot be dispatched from status ${order.status}`
        );

        error.statusCode = 400;
        throw error;
    }

    // 2. Change order to SEARCHING_DRIVER
    if (order.status === "CREATED") {
        await orderClient.updateOrderStatus(
            orderId,
            "SEARCHING_DRIVER"
        );
    }

    // 3. Get available drivers
    const drivers =
        await driverClient.getAvailableDrivers();

    if (!drivers || drivers.length === 0) {
        const error = new Error(
            "No available drivers"
        );

        error.statusCode = 409;
        throw error;
    }

    // 4. Find closest driver
    let bestDriver = null;
    let shortestDistance = Infinity;

    for (const driver of drivers) {
        try {
            const location =
                await locationClient.getDriverLocation(
                    driver.driver_id
                );

            if (!location) {
                continue;
            }

            const distance = calculateDistanceKm(
                location.latitude,
                location.longitude,
                order.pickup_latitude,
                order.pickup_longitude
            );

            if (distance < shortestDistance) {
                shortestDistance = distance;

                bestDriver = {
                    driver,
                    location,
                    distance,
                };
            }
        } catch (error) {
            // Driver has no location or location service failed.
            // Skip this driver for now.
            continue;
        }
    }

    if (!bestDriver) {
        const error = new Error(
            "No drivers with valid locations available"
        );

        error.statusCode = 409;
        throw error;
    }

    // 5. Mark driver as ON_DELIVERY
    await driverClient.updateDriverStatus(
        bestDriver.driver.driver_id,
        "BUSY"
    );

    // 6. Mark order as ASSIGNED
    const updatedOrder =
        await orderClient.updateOrderStatus(
            orderId,
            "ASSIGNED"
        );

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