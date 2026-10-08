require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");

const { connectProducer } = require("./events/orderProducer");

const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        // Check PostgreSQL connection
        await pool.query("SELECT 1");

        console.log("PostgreSQL connected");

        // Connect Kafka producer
        await connectProducer();

        console.log("Kafka producer connected");

        // Start HTTP server only after dependencies are ready
        app.listen(PORT, () => {
            console.log(`Order service running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start Order Service:", error);

        process.exit(1);
    }
}

startServer();