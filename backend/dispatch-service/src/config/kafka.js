
require("dotenv").config();

const { Kafka, logLevel } = require("kafkajs");

const kafka = new Kafka({
    clientId: "dispatch-service",

    brokers: [
        process.env.KAFKA_BROKER || "localhost:9092",
    ],

    // Required for hosted ntail Kafka
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

const consumer = kafka.consumer({
    groupId: "dispatch-service",
});

module.exports = {
    consumer,
};
