const config = require("./config");

const {
    createOrder,
    dispatchOrder,
} = require("./api/orderApi");

async function processOrder(drivers) {
    try {
        const order = await createOrder({
            customerId: `customer-${Date.now()}`,

            pickupLatitude:
                Math.random() *
                    (config.maxLatitude - config.minLatitude) +
                config.minLatitude,

            pickupLongitude:
                Math.random() *
                    (config.maxLongitude - config.minLongitude) +
                config.minLongitude,

            deliveryLatitude:
                Math.random() *
                    (config.maxLatitude - config.minLatitude) +
                config.minLatitude,

            deliveryLongitude:
                Math.random() *
                    (config.maxLongitude - config.minLongitude) +
                config.minLongitude,

            priority: "NORMAL",
        });

        console.log(
            `📦 New order: ${order.order_id}`
        );

        try {
            const result =
                await dispatchOrder(order.order_id);

            const assignedDriverId =
                result.driver.driver_id;

            const assignedDriver =
                drivers.find(
                    (driver) =>
                        driver.driverId ===
                        assignedDriverId
                );

            if (assignedDriver) {
                assignedDriver.status = "BUSY";
            }

            console.log(
                `🚚 Order ${order.order_id} ` +
                `assigned to driver ${assignedDriverId}`
            );
        } catch (error) {
            console.error(
                `⚠️ Dispatch failed for ${order.order_id}:`,
                error.response?.data ||
                    error.message
            );
        }
    } catch (error) {
        console.error(
            "❌ Order creation failed:",
            error.response?.data ||
                error.message
        );
    }
}

function startOrderSimulation(drivers) {
    setInterval(
        () => processOrder(drivers),
        config.orderIntervalMs
    );
}

module.exports = {
    startOrderSimulation,
};