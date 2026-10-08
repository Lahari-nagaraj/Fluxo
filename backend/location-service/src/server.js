require("dotenv").config();

const http = require("http");

const { Server } = require("socket.io");

const app = require("./app");

const pool = require("./config/database");

const {
    connectRedis,
} = require("./clients/redisClient");

const {
    initializeLocationSocket,
    broadcastLocation,
} = require("./websocket/locationSocket");

const PORT = process.env.PORT || 3003;

async function startServer() {
    try {
        // 1. Connect to PostgreSQL
        await pool.query("SELECT 1");

        console.log("PostgreSQL connected");

        // 2. Connect to Redis
        await connectRedis();

        console.log("Redis connected");

        // 3. Create HTTP server
        const httpServer =
            http.createServer(app);

        // 4. Initialize Socket.IO
        const io = new Server(httpServer, {
            cors: {
                origin: "*",
            },
        });

        // 5. Initialize location WebSocket handling
        initializeLocationSocket(io);

        // 6. Make broadcastLocation available to the application
        app.locals.broadcastLocation =
            (location) => {
                broadcastLocation(
                    io,
                    location
                );
            };

        // 7. Start HTTP server
        httpServer.listen(PORT, () => {
            console.log(
                `Location service running on port ${PORT}`
            );
        });

    } catch (error) {
        console.error(
            "Failed to start location service:",
            error
        );

        process.exit(1);
    }
}

startServer();