
const orderClient = require("../clients/orderClient");
const driverClient = require("../clients/driverClient");
const locationClient = require("../clients/locationClient");
const { startDeliveryLifecycle } = require("./deliveryLifecycleService");

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

function hasValidLocation(location) {
    if (
        !location ||
        location.latitude === undefined ||
        location.latitude === "" ||
        location.longitude === undefined ||
        location.longitude === ""
    ) {
        return false;
    }

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function hasFreshLocation(location) {
    return hasValidLocation(location);
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

        // 1. Gather available drivers: check specific zone set and global available set (inter-zone)
        let zoneDrivers = pickupZoneId
            ? await redisClient.sMembers(`drivers:available:${pickupZoneId}`)
            : [];
        let allAvailable =
            await redisClient.sMembers("drivers:available");

        let availableDriverIds = Array.from(
            new Set([...zoneDrivers, ...allAvailable])
        );

        // Fallback: If Redis has 0 available drivers, query Driver Service and populate Redis
        if (availableDriverIds.length === 0) {
            try {
                const driversFromService = await driverClient.getAvailableDrivers();
                if (Array.isArray(driversFromService) && driversFromService.length > 0) {
                    for (const d of driversFromService) {
                        availableDriverIds.push(d.driver_id);
                        await redisClient.sAdd("drivers:available", d.driver_id);
                        await redisClient.hSet(`driver:${d.driver_id}`, {
                            driverId: d.driver_id,
                            status: "AVAILABLE",
                            zoneId: d.zone_id || "",
                        });
                        if (d.zone_id) {
                            await redisClient.sAdd(
                                `drivers:available:${d.zone_id}`,
                                d.driver_id
                            );
                        }
                    }
                }
            } catch (fallbackErr) {
                console.warn(
                    "Fallback to driver service failed:",
                    fallbackErr.message
                );
            }
        }

        console.log(
            `Found ${availableDriverIds.length} available drivers for dispatch in/around zone ${pickupZoneId}`
        );

        const pickupLatitude = Number(order.pickup_latitude);
        const pickupLongitude = Number(order.pickup_longitude);

        const candidates = [];

        for (const driverId of availableDriverIds) {
            const driverState =
                await redisClient.hGetAll(`driver:${driverId}`);

            if (driverState && driverState.status && driverState.status !== "AVAILABLE") {
                await redisClient.sRem("drivers:available", driverId);
                if (pickupZoneId) {
                    await redisClient.sRem(
                        `drivers:available:${pickupZoneId}`,
                        driverId
                    );
                }
                continue;
            }

            const locationKey = `driver:location:${driverId}`;
            let location = await redisClient.hGetAll(locationKey);

            let driverLatitude = (location && location.latitude !== undefined && location.latitude !== "")
                ? Number(location.latitude)
                : NaN;
            let driverLongitude = (location && location.longitude !== undefined && location.longitude !== "")
                ? Number(location.longitude)
                : NaN;

            // If location not in Redis or invalid, fetch current location from Location Service at this time!
            if (!Number.isFinite(driverLatitude) || !Number.isFinite(driverLongitude)) {
                try {
                    const fallback = await locationClient.getDriverLocation(driverId);
                    if (fallback && fallback.latitude !== undefined && fallback.longitude !== undefined) {
                        const fbLat = Number(fallback.latitude);
                        const fbLng = Number(fallback.longitude);
                        if (Number.isFinite(fbLat) && Number.isFinite(fbLng)) {
                            driverLatitude = fbLat;
                            driverLongitude = fbLng;
                            const fbZone = fallback.zone_id || getZoneId(fbLat, fbLng);
                            location = {
                                latitude: String(fbLat),
                                longitude: String(fbLng),
                                zoneId: fbZone,
                                updatedAt: fallback.updated_at || new Date().toISOString(),
                            };
                            // Persist in Redis without 60s TTL
                            await redisClient.hSet(locationKey, location);
                        }
                    }
                } catch (err) {
                    // Location service lookup failed or driver has no recorded location
                }
            }

            if (!Number.isFinite(driverLatitude) || !Number.isFinite(driverLongitude)) {
                console.warn(
                    `No cached or current location for driver ${driverId}. Waiting for location update.`
                );
                continue;
            }

            if (
                !Number.isFinite(pickupLatitude) ||
                !Number.isFinite(pickupLongitude)
            ) {
                continue;
            }

            // Inter-geolocational distance calculation: find distance to pickup regardless of zone
            candidates.push({
                driverId,
                distance: calculateDistanceKm(
                    pickupLatitude,
                    pickupLongitude,
                    driverLatitude,
                    driverLongitude
                ),
                latitude: driverLatitude,
                longitude: driverLongitude,
                zoneId: location?.zoneId,
            });
        }

        // Sort candidates so the nearest driver is assigned first
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

                // Immediately update Redis availability sets and driver state
                await redisClient.sRem("drivers:available", candidate.driverId);
                if (candidate.zoneId) {
                    await redisClient.sRem(
                        `drivers:available:${candidate.zoneId}`,
                        candidate.driverId
                    );
                }
                if (pickupZoneId) {
                    await redisClient.sRem(
                        `drivers:available:${pickupZoneId}`,
                        candidate.driverId
                    );
                }
                await redisClient.hSet(`driver:${candidate.driverId}`, {
                    status: "BUSY",
                    updatedAt: new Date().toISOString(),
                });

                await orderClient.updateOrderStatus(
                    orderId,
                    "ASSIGNED"
                );

                order.status = "ASSIGNED";

                await removeFromWaiting(order);

                console.log(
                    `✅ Order ${orderId} assigned to nearest driver ${candidate.driverId} (${candidate.distance.toFixed(2)} km away)`
                );

                startDeliveryLifecycle(orderId, candidate.driverId);

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
                        await redisClient.sAdd("drivers:available", candidate.driverId);
                        if (candidate.zoneId) {
                            await redisClient.sAdd(
                                `drivers:available:${candidate.zoneId}`,
                                candidate.driverId
                            );
                        }
                        await redisClient.hSet(`driver:${candidate.driverId}`, {
                            status: "AVAILABLE",
                            updatedAt: new Date().toISOString(),
                        });
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
                        "drivers:available",
                        candidate.driverId
                    );
                    if (candidate.zoneId) {
                        await redisClient.sRem(
                            `drivers:available:${candidate.zoneId}`,
                            candidate.driverId
                        );
                    }
                    if (pickupZoneId) {
                        await redisClient.sRem(
                            `drivers:available:${pickupZoneId}`,
                            candidate.driverId
                        );
                    }

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
