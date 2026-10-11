const { createClient } = require("redis");
const crypto = require("crypto");

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
    ttlSeconds = 120
) {
    const key =
        `driver:reservation:${driverId}`;
    const reservationToken =
        `${orderId}:${crypto.randomUUID()}`;

    const result =
        await redisClient.set(
            key,
            reservationToken,
            {
                NX: true,
                EX: ttlSeconds,
            }
        );

    return result === "OK"
        ? reservationToken
        : null;
}

async function releaseDriverReservation(
    driverId,
    reservationToken
) {
    const key =
        `driver:reservation:${driverId}`;

    return redisClient.eval(
        `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            end
            return 0
        `,
        {
            keys: [key],
            arguments: [reservationToken],
        }
    ).then((result) => Number(result) === 1);
}

async function reserveOrderDispatch(
    orderId,
    token = crypto.randomUUID(),
    ttlSeconds = 120
) {
    const result = await redisClient.set(
        `dispatch:reservation:${orderId}`,
        token,
        {
            NX: true,
            EX: ttlSeconds,
        }
    );

    return result === "OK" ? token : null;
}

async function releaseOrderDispatch(
    orderId,
    token
) {
    return redisClient.eval(
        `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            end
            return 0
        `,
        {
            keys: [`dispatch:reservation:${orderId}`],
            arguments: [token],
        }
    ).then((result) => Number(result) === 1);
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

async function getWaitingZones() {
    const zones = [];

    for await (const keys of redisClient.scanIterator({
        MATCH: "dispatch:waiting:*",
        COUNT: 100,
    })) {
        for (const key of keys) {
            zones.push(
                key.slice("dispatch:waiting:".length)
            );
        }
    }

    return zones;
}

module.exports = {
    redisClient,
    connectRedis,
    reserveDriver,
    releaseDriverReservation,
    reserveOrderDispatch,
    releaseOrderDispatch,
    addWaitingOrder,
    removeWaitingOrder,
    getWaitingOrders,
    getWaitingZones,
};