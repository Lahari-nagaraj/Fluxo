const { consumer } = require("../config/kafka");

const {
    dispatchOrder,
} = require("../services/dispatchService");

async function startOrderConsumer() {
    await consumer.connect();

    await consumer.subscribe({
        topic: "orders",
        fromBeginning: false,
    });

    console.log(
        "✅ Dispatch Service Kafka consumer connected"
    );

    await consumer.run({
        eachMessage: async ({
            topic,
            partition,
            message,
        }) => {
            const event =
                JSON.parse(
                    message.value.toString()
                );

            console.log(
                `📥 Received ${event.eventType}: ${event.orderId}`
            );

            if (
                event.eventType !==
                "OrderCreated"
            ) {
                return;
            }

            await dispatchOrder(
                event.orderId
            );
        },
    });
}

module.exports = {
    startOrderConsumer,
};