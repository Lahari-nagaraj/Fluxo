const { createClient } = require("redis");

const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (error) => {
    console.error("Redis Client Error:", error);
});

async function connectRedis() {
    if (!redisClient.isOpen) {
        await redisClient.connect();

        console.log(
            "Connected to Redis"
        );
    }
}

async function reserveDriver(
    driverId,
    orderId,
    ttlSeconds = 30
) {
    const key =
        `driver:reservation:${driverId}`;

    const result =
        await redisClient.set(
            key,
            orderId,
            {
                NX: true,
                EX: ttlSeconds,
            }
        );

    return result === "OK";
}

async function releaseDriverReservation(
    driverId,
    orderId
) {
    const key =
        `driver:reservation:${driverId}`;

    const currentOrderId =
        await redisClient.get(key);

    if (currentOrderId === orderId) {
        await redisClient.del(key);

        return true;
    }

    return false;
}

async function addWaitingOrder(
    orderId,
    zoneId
) {
    await redisClient.sAdd(
        `dispatch:waiting:${zoneId}`,
        orderId
    );
}

async function removeWaitingOrder(
    orderId,
    zoneId
) {
    await redisClient.sRem(
        `dispatch:waiting:${zoneId}`,
        orderId
    );
}

async function getWaitingOrders(
    zoneId
) {
    return redisClient.sMembers(
        `dispatch:waiting:${zoneId}`
    );
}

module.exports = {
    redisClient,
    connectRedis,
    reserveDriver,
    releaseDriverReservation,
    addWaitingOrder,
    removeWaitingOrder,
    getWaitingOrders,
};