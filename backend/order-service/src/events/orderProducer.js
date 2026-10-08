const { producer } = require("../config/kafka");

const TOPIC = "orders";

async function connectProducer() {
    await producer.connect();

    console.log(
        "✅ Order Service Kafka producer connected"
    );
}

async function publishOrderCreated(order) {
    await producer.send({
        topic: TOPIC,

        messages: [
            {
                key: order.order_id,

                value: JSON.stringify({
                    eventType: "OrderCreated",

                    orderId: order.order_id,

                    priority: order.priority,

                    pickupLatitude:
                        order.pickup_latitude,

                    pickupLongitude:
                        order.pickup_longitude,

                    deliveryLatitude:
                        order.delivery_latitude,

                    deliveryLongitude:
                        order.delivery_longitude,

                    timestamp:
                        new Date().toISOString(),
                }),
            },
        ],
    });

    console.log(
        `📤 OrderCreated published: ${order.order_id}`
    );
}

module.exports = {
    connectProducer,
    publishOrderCreated,
};