require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");

const {
    connectRedis,
} = require("./clients/redisClient");

const {
    connectKafka,
} = require("./config/kafka");

const PORT = process.env.PORT || 3002;

async function startServer() {
    try {
        // 1. Connect to PostgreSQL
        await pool.query("SELECT 1");

        console.log("PostgreSQL connected");

        // 2. Connect to Redis
        await connectRedis();

        console.log("Redis connected");

        // 3. Connect to Kafka
        await connectKafka();

        console.log("Kafka connected");

        // 4. Start HTTP server
        app.listen(PORT, () => {
            console.log(
                `Driver service running on port ${PORT}`
            );
        });
    } catch (error) {
        console.error(
            "Failed to start driver service:",
            error
        );

        process.exit(1);
    }
}

startServer();