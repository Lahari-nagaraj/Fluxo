const { Kafka } = require("kafkajs");

const {
    dispatchOrder,
} = require("../services/dispatchService");

const {
    redisClient,
    getWaitingOrders,
    removeWaitingOrder,
} = require("../clients/redisClient");

const kafka = new Kafka({
    clientId: "dispatch-driver-consumer",
    brokers: [
        process.env.KAFKA_BROKER ||
        "localhost:9092",
    ],
});

const consumer = kafka.consumer({
    groupId:
        "dispatch-driver-events",
});

async function startDriverConsumer() {
    await consumer.connect();

    await consumer.subscribe({
        topic: "drivers",
        fromBeginning: false,
    });

    console.log(
        "✅ Driver event consumer connected"
    );

    await consumer.run({
        eachMessage: async ({
            message,
        }) => {
            const event =
                JSON.parse(
                    message.value.toString()
                );

            if (
                event.eventType !==
                "DriverAvailable"
            ) {
                return;
            }

            console.log(
                `📥 Received DriverAvailable: ${event.driverId}`
            );

            if (!event.zoneId) {
                console.warn(
                    `Driver ${event.driverId} has no zone`
                );

                return;
            }

            const waitingOrders =
                await getWaitingOrders(
                    event.zoneId
                );

            console.log(
                `Found ${waitingOrders.length} waiting orders in ${event.zoneId}`
            );

            for (
                const orderId of waitingOrders
            ) {
                try {
                    const result =
                        await dispatchOrder(
                            orderId
                        );

                    if (
                        result?.status ===
                        "ASSIGNED"
                    ) {
                        await removeWaitingOrder(
                            orderId,
                            event.zoneId
                        );

                        console.log(
                            `🔄 Recovered waiting order ${orderId}`
                        );
                    }

                    if (
                        result?.status ===
                        "SKIPPED"
                    ) {
                        await removeWaitingOrder(
                            orderId,
                            event.zoneId
                        );
                    }
                } catch (error) {
                    console.error(
                        `Recovery failed for order ${orderId}:`,
                        error.message
                    );

                    // Keep the order in the
                    // waiting set so another
                    // DriverAvailable event
                    // can retry it.
                }
            }
        },
    });
}

module.exports = {
    startDriverConsumer,
};