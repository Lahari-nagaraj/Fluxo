require("dotenv").config();

const http = require("http");

const { Server } = require("socket.io");

const app = require("./app");

const pool = require("./config/database");

const {
    initializeLocationSocket,
    broadcastLocation,
} = require("./websocket/locationSocket");

const PORT = process.env.PORT || 3003;

async function startServer() {
    try {
        await pool.query("SELECT 1");

        console.log("PostgreSQL connected");

        const httpServer =
            http.createServer(app);

        const io = new Server(httpServer, {
            cors: {
                origin: "*",
            },
        });

        initializeLocationSocket(io);

        app.locals.broadcastLocation =
            (location) => {
                broadcastLocation(
                    io,
                    location
                );
            };

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