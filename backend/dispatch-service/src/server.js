require("dotenv").config();

const app = require("./app");
const config = require("./config/config");

const {
    connectRedis,
} = require("./clients/redisClient");

const {
    startOrderConsumer,
} = require("./events/orderConsumer");

const PORT = process.env.PORT || 3004;

async function startServer() {
    try {
        // 1. Connect to Redis
        await connectRedis();

        console.log("Redis connected");

        // 2. Start Kafka order consumer
        await startOrderConsumer();

        console.log("Kafka order consumer connected");

        // 3. Start HTTP server
        app.listen(PORT, () => {
            console.log(
                `Dispatch service running on port ${PORT}`
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