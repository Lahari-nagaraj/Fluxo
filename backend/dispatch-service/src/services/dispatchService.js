const orderClient = require("../clients/orderClient");
const driverClient = require("../clients/driverClient");
const locationClient = require("../clients/locationClient");

const {
    calculateDistanceKm,
} = require("../utils/distance");

const {
    redisClient,
} = require("../clients/redisClient");

const LOCATION_CACHE_TTL_SECONDS = 60;
const MAX_LOCATION_AGE_MS =
    LOCATION_CACHE_TTL_SECONDS * 1000;

function parseCoordinates(location) {
    if (
        !location ||
        location.latitude === undefined ||
        location.latitude === null ||
        location.longitude === undefined ||
        location.longitude === null ||
        location.latitude === "" ||
        location.longitude === ""
    ) {
        return null;
    }

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    return {
        latitude,
        longitude,
    };
}

async function getDriverCoordinates(driverId) {
    const locationKey =
        `driver:location:${driverId}`;
    const cachedLocation =
        await redisClient.hGetAll(locationKey);
    const cachedCoordinates =
        parseCoordinates(cachedLocation);

    if (cachedCoordinates) {
        return cachedCoordinates;
    }

    let persistedLocation;

    try {
        persistedLocation =
            await locationClient.getDriverLocation(
                driverId
            );
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }

        throw error;
    }

    const coordinates =
        parseCoordinates(persistedLocation);

    const updatedAt = new Date(
        persistedLocation?.updated_at ??
        persistedLocation?.updatedAt
    ).getTime();

    if (
        !coordinates ||
        !Number.isFinite(updatedAt) ||
        Date.now() - updatedAt > MAX_LOCATION_AGE_MS
    ) {
        return null;
    }

    await redisClient.hSet(locationKey, {
        latitude: String(coordinates.latitude),
        longitude: String(coordinates.longitude),
    });

    await redisClient.expire(
        locationKey,
        LOCATION_CACHE_TTL_SECONDS
    );

    return coordinates;
}

async function dispatchOrder(orderId) {
    console.log(
        `Dispatching order: ${orderId}`
    );

    // 1. Get order
    let order;

    try {
        order = await orderClient.getOrder(orderId);
    } catch (error) {
        // The Kafka event may refer to an order that no longer exists.
        // Do not retry such stale events forever.
        if (error.response?.status === 404) {
            console.warn(
                `⚠️ Order ${orderId} no longer exists. Skipping stale event.`
            );

            return {
                order_id: orderId,
                status: "NOT_FOUND",
                skipped: true,
            };
        }

        throw error;
    }

    if (!order) {
        console.warn(
            `⚠️ Order ${orderId} was not found. Skipping event.`
        );

        return {
            order_id: orderId,
            status: "NOT_FOUND",
            skipped: true,
        };
    }

    console.log(
        `Order ${orderId} current status: ${order.status}`
    );

    // 2. Validate order status
    // Idempotency: if this event is delivered again after
    // the order has already been assigned, do nothing.
    if (order.status === "ASSIGNED") {
        console.log(
            `⏭️ Order ${orderId} already assigned. Skipping duplicate event.`
        );

        return {
            order_id: orderId,
            status: "ASSIGNED",
            alreadyProcessed: true,
        };
    }

    if (
        order.status !== "CREATED" &&
        order.status !== "SEARCHING_DRIVER"
    ) {
        throw new Error(
            `Order cannot be dispatched from status ${order.status}`
        );
    }

    // 3. Get pickup zone from order
    const zoneId = order.pickup_zone_id;

    if (!zoneId) {
        const error = new Error(
            `Order ${orderId} does not have a pickup zone`
        );

        error.statusCode = 400;

        throw error;
    }

    console.log(
        `Order ${orderId} pickup zone: ${zoneId}`
    );

    // 4. Change order status to SEARCHING_DRIVER
    if (order.status === "CREATED") {
        await orderClient.updateOrderStatus(
            orderId,
            "SEARCHING_DRIVER"
        );

        console.log(
            `Order ${orderId} → SEARCHING_DRIVER`
        );
    }

    // 5. Get available drivers from the order's zone
    const availableDriversKey =
        `drivers:available:${zoneId}`;
    const driverIds =
        await redisClient.sMembers(
            availableDriversKey
        );

    if (!driverIds || driverIds.length === 0) {
        const error = new Error(
            `No available drivers in zone ${zoneId}`
        );

        error.statusCode = 409;

        throw error;
    }

    console.log(
        `Found ${driverIds.length} available drivers in zone ${zoneId}`
    );

    // 6. Find and rank drivers using fresh cached or persisted locations.
    const candidateDrivers = [];

    for (const driverId of driverIds) {
        const coordinates =
            await getDriverCoordinates(driverId);

        if (!coordinates) {
            console.warn(
                `No fresh location for driver ${driverId}; removing stale availability entry`
            );

            await redisClient.sRem(
                availableDriversKey,
                driverId
            );

            continue;
        }

        const distance = calculateDistanceKm(
            coordinates.latitude,
            coordinates.longitude,
            order.pickup_latitude,
            order.pickup_longitude
        );

        console.log(
            `Driver ${driverId}: ${distance.toFixed(3)} km`
        );

        candidateDrivers.push({
            driverId,
            distance,
        });
    }

    candidateDrivers.sort(
        (first, second) =>
            first.distance - second.distance
    );

    if (candidateDrivers.length === 0) {
        const error = new Error(
            `No drivers with fresh locations in zone ${zoneId}`
        );

        error.statusCode = 409;
        throw error;
    }

    // 7. Reserve the closest driver that is still available.
    let bestDriver = null;

    for (const candidate of candidateDrivers) {
        try {
            await driverClient.updateDriverStatus(
                candidate.driverId,
                "BUSY"
            );

            bestDriver = candidate;
            break;
        } catch (error) {
            if (error.response?.status !== 409) {
                throw error;
            }

            console.warn(
                `Driver ${candidate.driverId} is no longer available; trying the next candidate`
            );

            await redisClient.sRem(
                availableDriversKey,
                candidate.driverId
            );
        }
    }

    if (!bestDriver) {
        const error = new Error(
            `No available drivers in zone ${zoneId}`
        );

        error.statusCode = 409;
        throw error;
    }

    console.log(
        `Assigned driver ${bestDriver.driverId} ` +
        `(${bestDriver.distance.toFixed(3)} km)`
    );

    // 8. Mark order as ASSIGNED
    const updatedOrder =
        await orderClient.updateOrderStatus(
            orderId,
            "ASSIGNED"
        );

    console.log(
        `Order ${orderId} → ASSIGNED`
    );

    // 9. Return dispatch result
    return {
        order: updatedOrder,
        driver: {
            driver_id: bestDriver.driverId,
        },
        distanceKm: Number(
            bestDriver.distance.toFixed(3)
        ),
    };
}

module.exports = {
    dispatchOrder,
};