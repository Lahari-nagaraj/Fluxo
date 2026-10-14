
require("dotenv").config();

const { Kafka, logLevel } = require("kafkajs");

const {
    dispatchOrder,
} = require("../services/dispatchService");

const {
    redisClient,
    getWaitingOrders,
    getWaitingZones,
    removeWaitingOrder,
} = require("../clients/redisClient");

const RECOVERY_INTERVAL_MS = 10_000;

const kafka = new Kafka({
    clientId: "dispatch-driver-consumer",
    brokers: [
        process.env.KAFKA_BROKER || "localhost:9092",
    ],
    ssl: true,
    sasl:
        process.env.KAFKA_USERNAME &&
        process.env.KAFKA_PASSWORD
            ? {
                  mechanism: "plain",
                  username: process.env.KAFKA_USERNAME,
                  password: process.env.KAFKA_PASSWORD,
              }
            : undefined,
    logLevel: logLevel ? logLevel.ERROR : undefined,
});

const consumer = kafka.consumer({
    groupId: "dispatch-driver-events",
});

let recoveryInProgress = false;
let recoveryTimer;

async function recoverWaitingOrders(zoneId) {
    if (recoveryInProgress) {
        return;
    }

    recoveryInProgress = true;

    try {
        const allZones = await getWaitingZones();

        const zones = zoneId
            ? [
                  zoneId,
                  ...allZones.filter((z) => z !== zoneId),
              ]
            : allZones;

        for (const waitingZoneId of zones) {
            const waitingOrders =
                await getWaitingOrders(waitingZoneId);

            console.log(
                `Found ${waitingOrders.length} waiting orders in ${waitingZoneId}`
            );

            for (const orderId of waitingOrders) {
                try {
                    const result =
                        await dispatchOrder(orderId);

                    if (
                        [
                            "ASSIGNED",
                            "ALREADY_ASSIGNED",
                            "SKIPPED",
                        ].includes(result?.status)
                    ) {
                        await removeWaitingOrder(
                            orderId,
                            waitingZoneId
                        );

                        console.log(
                            `🔄 Recovery processed order ${orderId}: ${result.status}`
                        );
                    } else if (
                        result?.status === "WAITING_FOR_DRIVER"
                    ) {
                        console.log(
                            `⏳ Order ${orderId} remains waiting: ${result.reason}`
                        );
                    }
                } catch (error) {
                    console.error(
                        `Recovery failed for order ${orderId}:`,
                        error.message
                    );
                }
            }
        }
    } finally {
        recoveryInProgress = false;
    }
}

async function recoverForAvailableDriver(event) {
    let zoneId;

    if (event.driverId) {
        const location = await redisClient.hGetAll(
            `driver:location:${event.driverId}`
        );

        const driverState = await redisClient.hGetAll(
            `driver:${event.driverId}`
        );

        zoneId =
            location.zoneId ||
            driverState.zoneId ||
            event.zoneId;
    } else {
        zoneId = event.zoneId;
    }

    if (!zoneId) {
        console.warn(
            `Cannot recover waiting orders: no zone available for driver ${event.driverId || "unknown"}`
        );
        return;
    }

    await recoverWaitingOrders(zoneId);
}

async function startDriverConsumer() {
    await consumer.connect();

    await consumer.subscribe({
        topic: "drivers",
        fromBeginning: false,
    });

    console.log(
        "✅ Dispatch driver recovery consumer connected"
    );

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) {
                return;
            }

            let event;

            try {
                event = JSON.parse(
                    message.value.toString()
                );
            } catch (error) {
                console.error(
                    "Invalid driver event JSON:",
                    error.message
                );
                return;
            }

            if (event.eventType !== "DriverAvailable") {
                return;
            }

            console.log(
                `📥 Received DriverAvailable: ${event.driverId}`
            );

            await recoverForAvailableDriver(event);
        },
    });

    if (!recoveryTimer) {
        recoveryTimer = setInterval(() => {
            recoverWaitingOrders().catch((error) => {
                console.error(
                    "Waiting-order recovery scan failed:",
                    error.message
                );
            });
        }, RECOVERY_INTERVAL_MS);

        recoveryTimer.unref?.();
    }

    try {
        await recoverWaitingOrders();
    } catch (error) {
        console.error(
            "Initial waiting-order recovery scan failed:",
            error.message
        );
    }
}

function stopDriverRecovery() {
    if (recoveryTimer) {
        clearInterval(recoveryTimer);
        recoveryTimer = undefined;
    }
}

module.exports = {
    startDriverConsumer,
    recoverWaitingOrders,
    stopDriverRecovery,
};
