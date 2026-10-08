const { Kafka } = require("kafkajs");

const kafka = new Kafka({
    clientId: "dispatch-service",
    brokers: [
        process.env.KAFKA_BROKER || "localhost:9092",
    ],
});

const consumer = kafka.consumer({
    groupId: "dispatch-service",
});

module.exports = {
    consumer,
};