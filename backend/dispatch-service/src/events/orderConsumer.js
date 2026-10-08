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

            // --------------------------------------------------
            // Only process OrderCreated events
            // --------------------------------------------------

            if (
                event.eventType !==
                "OrderCreated"
            ) {
                return;
            }

            try {
                const result =
                    await dispatchOrder(
                        event.orderId
                    );

                // --------------------------------------------------
                // Driver temporarily unavailable
                //
                // This is a NORMAL business condition.
                //
                // The Kafka message has been successfully
                // processed, so we return normally.
                // --------------------------------------------------

                if (
                    result?.status ===
                    "WAITING_FOR_DRIVER"
                ) {
                    console.warn(
                        `⏳ Order ${event.orderId} is waiting for a driver`
                    );

                    console.warn(
                        `Reason: ${result.reason}`
                    );

                    return;
                }

                // --------------------------------------------------
                // Already assigned / skipped
                // --------------------------------------------------

                if (
                    result?.status ===
                    "ALREADY_ASSIGNED"
                ) {
                    console.log(
                        `ℹ️ Order ${event.orderId} was already assigned`
                    );

                    return;
                }

                if (
                    result?.status ===
                    "SKIPPED"
                ) {
                    console.log(
                        `ℹ️ Order ${event.orderId} skipped: ${result.reason}`
                    );

                    return;
                }

                // --------------------------------------------------
                // Successful assignment
                // --------------------------------------------------

                if (
                    result?.status ===
                    "ASSIGNED"
                ) {
                    console.log(
                        `✅ Order ${event.orderId} successfully dispatched to driver ${result.driverId}`
                    );

                    return;
                }

                console.log(
                    `ℹ️ Dispatch completed for order ${event.orderId}`
                );
            } catch (error) {
                // --------------------------------------------------
                // IMPORTANT:
                //
                // Genuine infrastructure/application failures
                // are still thrown.
                //
                // KafkaJS can therefore retry/restart processing
                // when something actually breaks.
                // --------------------------------------------------

                console.error(
                    `❌ Dispatch failed for order ${event.orderId}:`,
                    error.message
                );

                throw error;
            }
        },
    });
}


module.exports = {
    startOrderConsumer,
};