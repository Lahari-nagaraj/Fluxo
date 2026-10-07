const config = require("../config");
const orderApi = require("../api/orderApi");

function randomNumber(min, max) {
    return Math.random() * (max - min) + min;
}

function randomPriority() {
    const priorities = [
        "LOW",
        "NORMAL",
        "HIGH",
        "URGENT",
    ];

    return priorities[
        Math.floor(
            Math.random() * priorities.length
        )
    ];
}

async function generateOrder() {
    const order = await orderApi.createOrder({
        customerId:
            `customer-${Date.now()}`,

        pickupLatitude: randomNumber(
            config.minLatitude,
            config.maxLatitude
        ),

        pickupLongitude: randomNumber(
            config.minLongitude,
            config.maxLongitude
        ),

        deliveryLatitude: randomNumber(
            config.minLatitude,
            config.maxLatitude
        ),

        deliveryLongitude: randomNumber(
            config.minLongitude,
            config.maxLongitude
        ),

        priority: randomPriority(),
    });

    console.log(
        `📦 New order created: ${order.order_id}`
    );

    return order;
}

module.exports = {
    generateOrder,
};