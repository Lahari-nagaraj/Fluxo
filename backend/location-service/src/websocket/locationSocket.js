function initializeLocationSocket(io) {
    io.on("connection", (socket) => {
        console.log(
            `Location client connected: ${socket.id}`
        );

        socket.on("disconnect", () => {
            console.log(
                `Location client disconnected: ${socket.id}`
            );
        });
    });
}

function broadcastLocation(io, location) {
    io.emit("driver_location_updated", {
        driverId: location.driver_id,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        zoneId: location.zone_id,
        updatedAt: location.updated_at,
    });
}

module.exports = {
    initializeLocationSocket,
    broadcastLocation,
};