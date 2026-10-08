const app = require("./app");
const config = require("./config/config");

const {
    startOrderConsumer,
} = require("./events/orderConsumer");

async function startServer() {
    try {
        // Connect to Kafka and start consuming OrderCreated events
        await startOrderConsumer();

        console.log("Kafka order consumer started");

        // Start HTTP server
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