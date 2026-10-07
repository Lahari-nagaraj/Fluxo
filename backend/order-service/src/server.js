require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");

const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        await pool.query("SELECT 1");

        console.log("PostgreSQL connected");

        app.listen(PORT, () => {
            console.log(`Order service running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();