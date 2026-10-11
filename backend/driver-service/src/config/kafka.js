const { Kafka } = require("kafkajs");

const kafka = new Kafka({
    clientId: "driver-service",
    brokers: [
        process.env.KAFKA_BROKER ||
        "localhost:9092",
    ],
});

const producer =
    kafka.producer();

async function connectKafka() {
    await producer.connect();

    console.log(
        "Connected to Kafka"
    );
}

async function publishDriverAvailable(
    driver
) {
    await producer.send({
        topic: "drivers",
        messages: [
            {
                key: driver.driver_id,
                value: JSON.stringify({
                    eventType:
                        "DriverAvailable",
                    driverId:
                        driver.driver_id,
                    zoneId:
                        driver.zone_id,
                    timestamp:
                        new Date().toISOString(),
                }),
            },
        ],
    });

    console.log(
        `📤 DriverAvailable published for ${driver.driver_id}`
    );
}

module.exports = {
    producer,
    connectKafka,
    publishDriverAvailable,
};