
require("dotenv").config();

const app = require("./app");
const config = require("./config/config");

const {
    connectRedis,
} = require("./clients/redisClient");

const {
    startOrderConsumer,
} = require("./events/orderConsumer");

const {
    startDriverConsumer,
} = require("./events/driverConsumer");


const PORT = process.env.PORT || 3004;

async function startServer() {
    try {
        await connectRedis();
        console.log("Redis connected");

        await startOrderConsumer();
        console.log("Kafka order consumer connected");

        await startDriverConsumer();
        console.log("Kafka driver recovery consumer connected");


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
