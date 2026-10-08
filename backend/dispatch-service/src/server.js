const app = require("./app");
const config = require("./config/config");

const {
    connectRedis,
} = require("./clients/redisClient");

const {
    startOrderConsumer,
} = require("./events/orderConsumer");

async function startServer() {
    try {
        // 1. Connect to Redis
        await connectRedis();

        console.log("Redis connected");

        // 2. Start Kafka consumer
        await startOrderConsumer();

        console.log("Kafka order consumer started");

        // 3. Start HTTP server
        app.listen(config.port, () => {
            console.log(
                `Dispatch service running on port ${config.port}`
            );
        });
    } catch (error) {
        console.error(
            "Failed to start Dispatch Service:",
            error
        );

        process.exit(1);
    }
}

startServer();