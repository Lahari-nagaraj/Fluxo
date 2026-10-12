const orderClient = require("../clients/orderClient");
const driverClient = require("../clients/driverClient");
const config = require("../config/config");
const { redisClient } = require("../clients/redisClient");

// In-memory registry of ongoing timers (orderId -> timer info)
const activeDeliveries = new Map();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Executes the full lifecycle progression for an assigned order:
 * 1. Picks random pickup time (2-5 minutes) and updates state to PICKUP
 * 2. Waits for that duration, then picks random in-transit time (10-12 minutes) and updates state to IN_TRANSIT
 * 3. Waits for that duration, then updates state to DELIVERED
 * 4. Brings the driver back to Redis and AVAILABLE state, ready for next orders
 */
function startDeliveryLifecycle(orderId, driverId) {
    if (!orderId || !driverId) {
        return;
    }

    if (activeDeliveries.has(orderId)) {
        console.log(`ℹ️ [Lifecycle] Order ${orderId} already has an active delivery progression running.`);
        return;
    }

    const simMinuteMs = config.simulationMinuteMs || 1000;

    const deliveryRecord = {
        orderId,
        driverId,
        startedAt: new Date().toISOString(),
        currentStatus: "ASSIGNED",
    };

    activeDeliveries.set(orderId, deliveryRecord);

    // Launch progression asynchronously so dispatch endpoint returns immediately
    (async () => {
        try {
            let orderDetails = null;
            try {
                orderDetails = await orderClient.getOrder(orderId);
            } catch (err) {
                // Non-critical order lookup
            }

            const locationId = orderDetails?.location_id || "";
            const deliveryInstructions = orderDetails?.delivery_instructions || "";

            // Save initial assignment in Redis
            await redisClient.hSet(`assignment:${orderId}`, {
                orderId,
                driverId,
                status: "ASSIGNED",
                locationId,
                deliveryInstructions,
                assignedAt: new Date().toISOString(),
            });
            await redisClient.set(`order:driver:${orderId}`, driverId);
            await redisClient.set(`driver:order:${driverId}`, orderId);
            await redisClient.sAdd("orders:active_assignments", orderId);

            if (deliveryInstructions) {
                console.log(
                    `🔔 [Location Reminder for Driver ${driverId}] Order ${orderId} (Location: ${locationId}):\n` +
                    `   → Door Note: "${deliveryInstructions}"`
                );
            }

            // ==============================================================
            // STEP 1: PICKUP STATE (2 to 5 minutes)
            // ==============================================================
            const pickupMinutes = getRandomInt(2, 5);
            const pickupDurationMs = pickupMinutes * simMinuteMs;

            deliveryRecord.pickupMinutes = pickupMinutes;
            deliveryRecord.pickupDurationMs = pickupDurationMs;

            console.log(
                `⏱️ [Delivery] Order ${orderId} assigned to driver ${driverId}.\n` +
                `   → Updating state to PICKUP.\n` +
                `   → Holding in pickup for ${pickupMinutes} minutes (${(pickupDurationMs / 1000).toFixed(1)}s in simulation)...`
            );

            // Update order status in Order Service
            await orderClient.updateOrderStatus(orderId, "PICKUP");
            deliveryRecord.currentStatus = "PICKUP";

            // Mark driver ON_DELIVERY (BUSY -> ON_DELIVERY is valid in driver service)
            try {
                await driverClient.updateDriverStatus(driverId, "ON_DELIVERY");
            } catch (driverErr) {
                console.warn(`[Lifecycle] Could not set driver ${driverId} to ON_DELIVERY:`, driverErr.message);
            }

            // Update Redis state
            await redisClient.hSet(`assignment:${orderId}`, {
                status: "PICKUP",
                pickupMinutes: String(pickupMinutes),
                pickupAt: new Date().toISOString(),
                pickedUpAt: new Date().toISOString(),
            });

            // Wait for pickup duration
            await sleep(pickupDurationMs);

            // ==============================================================
            // STEP 2: IN_TRANSIT STATE (10 to 12 minutes)
            // ==============================================================
            const transitMinutes = getRandomInt(10, 12);
            const transitDurationMs = transitMinutes * simMinuteMs;

            deliveryRecord.transitMinutes = transitMinutes;
            deliveryRecord.transitDurationMs = transitDurationMs;

            console.log(
                `🚚 [Delivery] Pickup completed for order ${orderId} (driver ${driverId}).\n` +
                `   → Updating state to IN_TRANSIT.\n` +
                `   → Holding in-transit for ${transitMinutes} minutes (${(transitDurationMs / 1000).toFixed(1)}s in simulation)...`
            );

            // Update order status in Order Service
            await orderClient.updateOrderStatus(orderId, "IN_TRANSIT");
            deliveryRecord.currentStatus = "IN_TRANSIT";

            // Update Redis state
            await redisClient.hSet(`assignment:${orderId}`, {
                status: "IN_TRANSIT",
                transitMinutes: String(transitMinutes),
                inTransitAt: new Date().toISOString(),
            });

            // Wait for in-transit duration
            await sleep(transitDurationMs);

            // ==============================================================
            // STEP 3: DELIVERED STATE
            // ==============================================================
            console.log(
                `🎉 [Delivery] Transit complete! Order ${orderId} has been DELIVERED by driver ${driverId}!`
            );

            // Update order status in Order Service
            await orderClient.updateOrderStatus(orderId, "DELIVERED");
            deliveryRecord.currentStatus = "DELIVERED";

            await redisClient.hSet(`assignment:${orderId}`, {
                status: "DELIVERED",
                deliveredAt: new Date().toISOString(),
            });

            // Clean up active assignment mappings in Redis
            await redisClient.del(`driver:order:${driverId}`);
            await redisClient.del(`order:driver:${orderId}`);
            await redisClient.sRem("orders:active_assignments", orderId);

            // ==============================================================
            // STEP 4: BRING BACK DRIVER TO REDIS & AVAILABLE STATE
            // ==============================================================
            console.log(
                `🔄 [Driver Fleet] Resetting driver ${driverId} back to AVAILABLE in Driver Service and Redis...`
            );

            await driverClient.updateDriverStatus(driverId, "AVAILABLE");

            console.log(
                `✅ [Driver Fleet] Driver ${driverId} is back to AVAILABLE! Added to Redis set & ready for next orders.`
            );

        } catch (error) {
            console.error(
                `❌ [Lifecycle Error] Failed during delivery lifecycle for order ${orderId} / driver ${driverId}:`,
                error.message
            );

            // Self-healing: if progression encounters an unexpected error, ensure driver is not permanently stuck
            try {
                await driverClient.updateDriverStatus(driverId, "AVAILABLE");
                await redisClient.del(`driver:order:${driverId}`);
                await redisClient.del(`order:driver:${orderId}`);
                await redisClient.sRem("orders:active_assignments", orderId);
                console.log(`🩹 [Recovery] Restored driver ${driverId} to AVAILABLE after lifecycle error.`);
            } catch (recoveryErr) {
                console.error(`[Recovery Failed] Could not restore driver ${driverId}:`, recoveryErr.message);
            }
        } finally {
            activeDeliveries.delete(orderId);
        }
    })();
}

/**
 * Returns current assignment information from Redis
 */
async function getAssignment(orderId) {
    return redisClient.hGetAll(`assignment:${orderId}`);
}

/**
 * Returns all active assignments currently in flight
 */
async function getActiveAssignments() {
    const orderIds = await redisClient.sMembers("orders:active_assignments");
    const assignments = [];

    for (const orderId of orderIds) {
        const data = await redisClient.hGetAll(`assignment:${orderId}`);
        if (data && Object.keys(data).length > 0) {
            assignments.push(data);
        }
    }

    return assignments;
}

/**
 * Scans for any drivers that are stuck BUSY or ON_DELIVERY without an active timer,
 * and resets them back to AVAILABLE in PostgreSQL & Redis.
 */
async function resetStuckDrivers() {
    try {
        const drivers = await driverClient.getAllDrivers();
        const busyDrivers = (drivers || []).filter(
            (d) => d.status === "BUSY" || d.status === "ON_DELIVERY"
        );

        let resetCount = 0;
        const resetDriverIds = [];

        for (const driver of busyDrivers) {
            const currentOrderId = await redisClient.get(`driver:order:${driver.driver_id}`);
            // If no active in-flight delivery timer is running for this driver, restore them
            if (!currentOrderId || !activeDeliveries.has(currentOrderId)) {
                await driverClient.updateDriverStatus(driver.driver_id, "AVAILABLE");
                await redisClient.del(`driver:order:${driver.driver_id}`);
                if (currentOrderId) {
                    await redisClient.del(`order:driver:${currentOrderId}`);
                    await redisClient.sRem("orders:active_assignments", currentOrderId);
                }
                resetDriverIds.push(driver.driver_id);
                resetCount++;
            }
        }

        console.log(`🧹 [Fleet Reset] Reset ${resetCount} stuck drivers back to AVAILABLE.`);

        return {
            resetCount,
            resetDriverIds,
        };
    } catch (error) {
        console.error("Failed to reset stuck drivers:", error.message);
        throw error;
    }
}

module.exports = {
    startDeliveryLifecycle,
    getAssignment,
    getActiveAssignments,
    resetStuckDrivers,
    activeDeliveries,
};
