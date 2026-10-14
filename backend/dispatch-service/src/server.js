
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

const {
    startWaitingOrderPoller,
} = require("./events/waitingOrderPoller");

const PORT = process.env.PORT || 3004;

async function startServer() {
    try {
        await connectRedis();
        console.log("Redis connected");

        // Start Kafka consumers (with safe fallback if Kafka is offline)
        try {
            await startOrderConsumer();
            console.log("Kafka order consumer connected");
        } catch (kafkaOrderErr) {
            console.warn("Kafka order consumer connection delayed:", kafkaOrderErr.message);
        }

        try {
            await startDriverConsumer();
            console.log("Kafka driver recovery consumer connected");
        } catch (kafkaDriverErr) {
            console.warn("Kafka driver recovery consumer connection delayed:", kafkaDriverErr.message);
        }

        // Start waiting & unassigned order poller to ensure zero dropped orders
        startWaitingOrderPoller();


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
