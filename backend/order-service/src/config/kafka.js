/*const { Kafka } = require("kafkajs");

const kafka = new Kafka({
    clientId: "order-service",
    brokers: [
        process.env.KAFKA_BROKER || "localhost:9092",
    ],
});

const producer = kafka.producer();

module.exports = {
    kafka,
    producer,
};
*/


require("dotenv").config();

const { Kafka, logLevel } = require("kafkajs");

const kafka = new Kafka({
    clientId: "order-service",
    brokers: [
        process.env.KAFKA_BROKER || "localhost:9092",
    ],
    ssl: true,
    sasl: process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD
        ? {
              mechanism: "plain",
              username: process.env.KAFKA_USERNAME,
              password: process.env.KAFKA_PASSWORD,
          }
        : undefined,
    logLevel: logLevel.ERROR,
});

const producer = kafka.producer();

module.exports = {
    kafka,
    producer,
};
