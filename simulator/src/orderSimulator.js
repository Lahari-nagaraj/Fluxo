const config = require("./config");

const {
    createOrder,
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