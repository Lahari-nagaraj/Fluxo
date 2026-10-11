
const orderClient = require("../clients/orderClient");
const driverClient = require("../clients/driverClient");
const locationClient = require("../clients/locationClient");

const {
    calculateDistanceKm,
} = require("../utils/distance");

const {
    getZoneId,
} = require("../utils/zone");

const {
    redisClient,
    reserveDriver,
    releaseDriverReservation,
    reserveOrderDispatch,
    releaseOrderDispatch,
    addWaitingOrder,
    removeWaitingOrder,
} = require("../clients/redisClient");

const LOCATION_TTL_SECONDS = 60;
const LOCATION_CLOCK_SKEW_MS = 5_000;

function hasFreshLocation(location, ttl, expectedZoneId) {
    if (
        !location ||
        location.latitude === undefined ||
        location.latitude === "" ||
        location.longitude === undefined ||
        location.longitude === "" ||
        !Number.isInteger(ttl) ||
        (ttl <= 0 && ttl !== -1)
    ) {
        return false;
    }

    const updatedAt = Date.parse(location.updatedAt);
    const ageMs = Date.now() - updatedAt;

    if (
        !Number.isFinite(updatedAt) ||
        ageMs < -LOCATION_CLOCK_SKEW_MS ||
        ageMs > LOCATION_TTL_SECONDS * 1000
    ) {
        return false;
    }

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        getZoneId(latitude, longitude) === expectedZoneId &&
        location.zoneId === expectedZoneId
    );
}

function isEligibleOrder(order) {
    return (
        order.status === "CREATED" ||
        order.status === "SEARCHING_DRIVER"
    );
}

async function removeFromWaiting(order) {
    if (order?.pickup_zone_id) {
        await removeWaitingOrder(
            order.order_id,
            order.pickup_zone_id
        );
    }
}

async function dispatchOrder(orderId) {
    const orderLock = await reserveOrderDispatch(orderId);

    if (!orderLock) {
        return {
            status: "IN_PROGRESS",
            reason: "ORDER_DISPATCH_IN_PROGRESS",
            orderId,
        };
    }

    let order;
    let pickupZoneId;

    try {
        try {
            order = await orderClient.getOrder(orderId);
        } catch (error) {
            if (error.response?.status === 404) {
                console.warn(
                    `Order ${orderId} no longer exists. Skipping stale event.`
                );

                return {
                    status: "SKIPPED",
                    reason: "ORDER_NOT_FOUND",
                    orderId,
                };
            }

            throw error;
        }

        console.log(
            `Order ${orderId} current status: ${order.status}`
        );

        if (order.status === "ASSIGNED") {
            await removeFromWaiting(order);

            return {
                status: "ALREADY_ASSIGNED",
                orderId,
            };
        }

        if (!isEligibleOrder(order)) {
            await removeFromWaiting(order);

            return {
                status: "SKIPPED",
                reason: "INVALID_DISPATCH_STATUS",
                orderId,
            };
        }

        pickupZoneId = order.pickup_zone_id;

        if (!pickupZoneId) {
            const error = new Error(
                `Order ${orderId} does not have a pickup zone`
            );

            error.statusCode = 500;
            throw error;
        }

        if (order.status === "CREATED") {
            await orderClient.updateOrderStatus(
                orderId,
                "SEARCHING_DRIVER"
            );

            order.status = "SEARCHING_DRIVER";
        }

        const availableDriverIds =
            await redisClient.sMembers(
                `drivers:available:${pickupZoneId}`
            );

        console.log(
            `Found ${availableDriverIds.length} available drivers in zone ${pickupZoneId}`
        );

        const candidates = [];

        for (const driverId of availableDriverIds) {
            const driverState =
                await redisClient.hGetAll(
                    `driver:${driverId}`
                );

            if (driverState.status !== "AVAILABLE") {
                await redisClient.sRem(
                    `drivers:available:${pickupZoneId}`,
                    driverId
                );

                continue;
            }

            const locationKey =
                `driver:location:${driverId}`;

            let location =
                await redisClient.hGetAll(locationKey);

            let locationTtl =
                await redisClient.ttl(locationKey);

            if (!location || !location.latitude || !hasFreshLocation(location, locationTtl, pickupZoneId)) {
                try {
                    const fallback = await locationClient.getDriverLocation(driverId);
                    if (fallback && fallback.latitude !== undefined && fallback.longitude !== undefined) {
                        const fbLat = Number(fallback.latitude);
                        const fbLng = Number(fallback.longitude);
                        const fbZone = fallback.zone_id || getZoneId(fbLat, fbLng);
                        if (fbZone === pickupZoneId) {
                            location = {
                                latitude: String(fbLat),
                                longitude: String(fbLng),
                                zoneId: fbZone,
                                updatedAt: fallback.updated_at || new Date().toISOString(),
                            };
                            locationTtl = 60;
                            await redisClient.hSet(locationKey, location);
                            await redisClient.expire(locationKey, 60);
                        }
                    }
                } catch (err) {
                    // Fallback to location service not available or not found
                }
            }

            if (
                location.latitude === undefined ||
                location.latitude === "" ||
                location.longitude === undefined ||
                location.longitude === ""
            ) {
                console.warn(
                    `No cached location for driver ${driverId}. Waiting for location update.`
                );

                continue;
            }

            if (
                !hasFreshLocation(
                    location,
                    locationTtl,
                    pickupZoneId
                )
            ) {
                console.warn(
                    `Skipping driver ${driverId}: cached location is stale or outside zone ${pickupZoneId}.`
                );

                continue;
            }

            const driverLatitude = Number(location.latitude);
            const driverLongitude = Number(location.longitude);
            const pickupLatitude = Number(order.pickup_latitude);
            const pickupLongitude = Number(order.pickup_longitude);

            if (
                !Number.isFinite(pickupLatitude) ||
                !Number.isFinite(pickupLongitude)
            ) {
                continue;
            }

            candidates.push({
                driverId,
                distance: calculateDistanceKm(
                    pickupLatitude,
                    pickupLongitude,
                    driverLatitude,
                    driverLongitude
                ),
            });
        }

        candidates.sort((left, right) =>
            left.distance - right.distance
        );

        for (const candidate of candidates) {
            const reservationToken =
                await reserveDriver(
                    candidate.driverId,
                    orderId,
                    120
                );

            if (!reservationToken) {
                continue;
            }

            let driverMarkedBusy = false;

            try {
                await driverClient.updateDriverStatus(
                    candidate.driverId,
                    "BUSY"
                );

                driverMarkedBusy = true;

                await orderClient.updateOrderStatus(
                    orderId,
                    "ASSIGNED"
                );

                order.status = "ASSIGNED";

                await removeFromWaiting(order);

                console.log(
                    `✅ Order ${orderId} assigned to driver ${candidate.driverId}`
                );

                return {
                    status: "ASSIGNED",
                    orderId,
                    driverId: candidate.driverId,
                    distanceKm: candidate.distance,
                };
            } catch (error) {
                let latestOrder;

                try {
                    latestOrder =
                        await orderClient.getOrder(orderId);

                    order = latestOrder;
                } catch (orderReadError) {
                    console.error(
                        `Could not verify order ${orderId} after assignment failure:`,
                        orderReadError.message
                    );
                }

                if (
                    latestOrder &&
                    isEligibleOrder(latestOrder) &&
                    latestOrder.pickup_zone_id
                ) {
                    try {
                        await addWaitingOrder(
                            orderId,
                            latestOrder.pickup_zone_id
                        );
                    } catch (waitingError) {
                        console.error(
                            `Failed to preserve waiting order ${orderId}:`,
                            waitingError.message
                        );
                    }
                } else if (latestOrder) {
                    try {
                        await removeFromWaiting(latestOrder);
                    } catch (waitingError) {
                        console.error(
                            `Failed to clean up waiting order ${orderId}:`,
                            waitingError.message
                        );
                    }
                }

                if (
                    driverMarkedBusy &&
                    latestOrder &&
                    latestOrder.status !== "ASSIGNED"
                ) {
                    try {
                        await driverClient.updateDriverStatus(
                            candidate.driverId,
                            "AVAILABLE"
                        );
                    } catch (compensationError) {
                        console.error(
                            `Failed to release driver ${candidate.driverId} after assignment failure:`,
                            compensationError.message
                        );
                    }
                }

                if (
                    error.response?.status === 409 &&
                    !driverMarkedBusy
                ) {
                    await redisClient.sRem(
                        `drivers:available:${pickupZoneId}`,
                        candidate.driverId
                    );

                    continue;
                }

                throw error;
            } finally {
                await releaseDriverReservation(
                    candidate.driverId,
                    reservationToken
                );
            }
        }

        const reason =
            availableDriverIds.length === 0
                ? "NO_DRIVER_IN_ZONE"
                : candidates.length === 0
                    ? "NO_VALID_DRIVER_LOCATION"
                    : "DRIVER_RESERVATION_FAILED";

        await addWaitingOrder(orderId, pickupZoneId);

        console.warn(
            `Order ${orderId} is waiting for a driver: ${reason}`
        );

        return {
            status: "WAITING_FOR_DRIVER",
            reason,
            orderId,
            zoneId: pickupZoneId,
        };
    } catch (error) {
        if (
            order &&
            pickupZoneId &&
            isEligibleOrder(order)
        ) {
            try {
                await addWaitingOrder(
                    orderId,
                    pickupZoneId
                );
            } catch (waitingError) {
                console.error(
                    `Failed to preserve eligible order ${orderId} after dispatch failure:`,
                    waitingError.message
                );
            }
        }

        throw error;
    } finally {
        await releaseOrderDispatch(orderId, orderLock);
    }
}

module.exports = {
    dispatchOrder,
};
