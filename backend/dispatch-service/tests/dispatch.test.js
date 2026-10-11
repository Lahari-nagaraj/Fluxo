jest.mock("../src/clients/orderClient", () => ({
    getOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
}));

jest.mock("../src/clients/driverClient", () => ({
    updateDriverStatus: jest.fn(),
}));

jest.mock("../src/clients/redisClient", () => ({
    redisClient: {
        hGetAll: jest.fn(),
        sMembers: jest.fn(),
        sRem: jest.fn(),
        ttl: jest.fn(),
    },
    reserveDriver: jest.fn(),
    releaseDriverReservation: jest.fn(),
    reserveOrderDispatch: jest.fn(),
    releaseOrderDispatch: jest.fn(),
    addWaitingOrder: jest.fn(),
    removeWaitingOrder: jest.fn(),
}));

const orderClient = require("../src/clients/orderClient");
const driverClient = require("../src/clients/driverClient");
const redis = require("../src/clients/redisClient");
const { dispatchOrder } = require("../src/services/dispatchService");

const ZONE_ID = "ZONE_2059_5151";

function makeOrder(orderId, status = "SEARCHING_DRIVER") {
    return {
        order_id: orderId,
        pickup_zone_id: ZONE_ID,
        pickup_latitude: 12.9716,
        pickup_longitude: 77.5946,
        status,
    };
}

function makeLocation(latitude = 12.972, longitude = 77.595, ageMs = 0) {
    return {
        latitude: String(latitude),
        longitude: String(longitude),
        zoneId: ZONE_ID,
        updatedAt: new Date(Date.now() - ageMs).toISOString(),
    };
}

describe("Dispatch assignment and waiting-order safety", () => {
    let orders;
    let availableDrivers;
    let driverReservations;
    let orderReservations;
    let waitingOrders;
    let driverLocations;

    beforeEach(() => {
        jest.clearAllMocks();

        orders = new Map();
        availableDrivers = [];
        driverReservations = new Set();
        orderReservations = new Set();
        waitingOrders = new Map();
        driverLocations = new Map();

        redis.reserveOrderDispatch.mockImplementation(
            async (orderId) => {
                if (orderReservations.has(orderId)) {
                    return null;
                }
                orderReservations.add(orderId);
                return `lock-${orderId}`;
            }
        );
        redis.releaseOrderDispatch.mockImplementation(
            async (orderId) => orderReservations.delete(orderId)
        );
        redis.reserveDriver.mockImplementation(
            async (driverId) => {
                if (driverReservations.has(driverId)) {
                    return false;
                }
                driverReservations.add(driverId);
                return `reservation-${driverId}`;
            }
        );
        redis.releaseDriverReservation.mockImplementation(
            async (driverId) => driverReservations.delete(driverId)
        );
        redis.addWaitingOrder.mockImplementation(
            async (orderId, zoneId) => {
                const zoneOrders =
                    waitingOrders.get(zoneId) || new Set();
                zoneOrders.add(orderId);
                waitingOrders.set(zoneId, zoneOrders);
            }
        );
        redis.removeWaitingOrder.mockImplementation(
            async (orderId, zoneId) =>
                waitingOrders.get(zoneId)?.delete(orderId)
        );
        redis.redisClient.sMembers.mockImplementation(
            async () => availableDrivers
        );
        redis.redisClient.hGetAll.mockImplementation(
            async (key) => {
                if (key.startsWith("driver:location:")) {
                    return driverLocations.get(
                        key.slice("driver:location:".length)
                    ) || {};
                }
                return {
                    status: "AVAILABLE",
                };
            }
        );
        redis.redisClient.ttl.mockResolvedValue(45);
        redis.redisClient.sRem.mockResolvedValue(1);

        orderClient.getOrder.mockImplementation(
            async (orderId) => orders.get(orderId)
        );
        orderClient.updateOrderStatus.mockImplementation(
            async (orderId, status) => {
                const order = orders.get(orderId);
                order.status = status;
                return order;
            }
        );
        driverClient.updateDriverStatus.mockResolvedValue({
            status: "BUSY",
        });
    });

    test("assigns an order to an available driver with a fresh cached location", async () => {
        orders.set("order-fresh", makeOrder("order-fresh"));
        availableDrivers = ["driver-1"];
        driverLocations.set("driver-1", makeLocation());

        const result = await dispatchOrder("order-fresh");

        expect(result).toMatchObject({
            status: "ASSIGNED",
            orderId: "order-fresh",
            driverId: "driver-1",
        });
        expect(driverClient.updateDriverStatus)
            .toHaveBeenCalledWith("driver-1", "BUSY");
        expect(orderClient.updateOrderStatus)
            .toHaveBeenCalledWith("order-fresh", "ASSIGNED");
        expect(waitingOrders.get(ZONE_ID)?.has("order-fresh"))
            .not.toBe(true);
        expect(redis.releaseDriverReservation)
            .toHaveBeenCalledWith(
                "driver-1",
                expect.any(String)
            );
    });

    test("stores the order in its pickup-zone waiting set when no location is cached", async () => {
        orders.set("order-no-location", makeOrder("order-no-location"));
        availableDrivers = ["driver-no-location"];

        const result = await dispatchOrder("order-no-location");

        expect(result).toMatchObject({
            status: "WAITING_FOR_DRIVER",
            reason: "NO_VALID_DRIVER_LOCATION",
            zoneId: ZONE_ID,
        });
        expect(waitingOrders.get(ZONE_ID)?.has("order-no-location"))
            .toBe(true);
        expect(driverClient.updateDriverStatus).not.toHaveBeenCalled();
    });

    test("does not use an expired or stale cached location", async () => {
        orders.set("order-stale", makeOrder("order-stale"));
        availableDrivers = ["driver-stale"];
        driverLocations.set(
            "driver-stale",
            makeLocation(12.972, 77.595, 61_000)
        );

        const result = await dispatchOrder("order-stale");

        expect(result.status).toBe("WAITING_FOR_DRIVER");
        expect(driverClient.updateDriverStatus).not.toHaveBeenCalled();
        expect(waitingOrders.get(ZONE_ID)?.has("order-stale"))
            .toBe(true);

        redis.redisClient.ttl.mockResolvedValue(-2);
        driverLocations.set("driver-stale", makeLocation());
        const expiredResult = await dispatchOrder("order-stale");

        expect(expiredResult.status).toBe("WAITING_FOR_DRIVER");
        expect(driverClient.updateDriverStatus).not.toHaveBeenCalled();
    });

    test("removes already assigned and cancelled orders from waiting without assigning", async () => {
        const assigned = makeOrder("assigned", "ASSIGNED");
        const cancelled = makeOrder("cancelled", "CANCELLED");
        orders.set("assigned", assigned);
        orders.set("cancelled", cancelled);

        await expect(dispatchOrder("assigned"))
            .resolves.toMatchObject({ status: "ALREADY_ASSIGNED" });
        await expect(dispatchOrder("cancelled"))
            .resolves.toMatchObject({ status: "SKIPPED" });

        expect(redis.removeWaitingOrder)
            .toHaveBeenNthCalledWith(1, "assigned", ZONE_ID);
        expect(redis.removeWaitingOrder)
            .toHaveBeenNthCalledWith(2, "cancelled", ZONE_ID);
        expect(driverClient.updateDriverStatus).not.toHaveBeenCalled();
    });

    test("serializes repeated dispatch events for the same order", async () => {
        orders.set("order-repeat", makeOrder("order-repeat"));
        availableDrivers = ["driver-1"];
        driverLocations.set("driver-1", makeLocation());

        let continueStatusUpdate;
        let statusUpdateStarted;
        const started = new Promise((resolve) => {
            statusUpdateStarted = resolve;
        });
        driverClient.updateDriverStatus.mockImplementationOnce(
            () => new Promise((resolve) => {
                continueStatusUpdate = resolve;
                statusUpdateStarted();
            })
        );

        const firstAttempt = dispatchOrder("order-repeat");
        await started;
        const duplicateAttempt = await dispatchOrder("order-repeat");

        expect(duplicateAttempt.status).toBe("IN_PROGRESS");
        continueStatusUpdate({ status: "BUSY" });
        await expect(firstAttempt)
            .resolves.toMatchObject({ status: "ASSIGNED" });
        expect(orderClient.updateOrderStatus)
            .toHaveBeenCalledTimes(1);
    });

    test("does not reserve one driver for two concurrent orders", async () => {
        orders.set("order-a", makeOrder("order-a"));
        orders.set("order-b", makeOrder("order-b"));
        availableDrivers = ["driver-1"];
        driverLocations.set("driver-1", makeLocation());

        let continueStatusUpdate;
        let statusUpdateStarted;
        const started = new Promise((resolve) => {
            statusUpdateStarted = resolve;
        });
        driverClient.updateDriverStatus.mockImplementationOnce(
            () => new Promise((resolve) => {
                continueStatusUpdate = resolve;
                statusUpdateStarted();
            })
        );

        const firstAttempt = dispatchOrder("order-a");
        await started;
        const secondAttempt = await dispatchOrder("order-b");

        expect(secondAttempt).toMatchObject({
            status: "WAITING_FOR_DRIVER",
            reason: "DRIVER_RESERVATION_FAILED",
        });
        expect(waitingOrders.get(ZONE_ID)?.has("order-b"))
            .toBe(true);

        continueStatusUpdate({ status: "BUSY" });
        await expect(firstAttempt)
            .resolves.toMatchObject({ status: "ASSIGNED" });
        expect(driverClient.updateDriverStatus)
            .toHaveBeenCalledTimes(1);
    });

    test("compensates a busy driver and preserves eligible orders after assignment fails", async () => {
        orders.set("order-failure", makeOrder("order-failure"));
        availableDrivers = ["driver-1"];
        driverLocations.set("driver-1", makeLocation());
        orderClient.updateOrderStatus.mockRejectedValueOnce(
            new Error("order service unavailable")
        );

        await expect(dispatchOrder("order-failure"))
            .rejects.toThrow("order service unavailable");

        expect(waitingOrders.get(ZONE_ID)?.has("order-failure"))
            .toBe(true);
        expect(driverClient.updateDriverStatus)
            .toHaveBeenNthCalledWith(1, "driver-1", "BUSY");
        expect(driverClient.updateDriverStatus)
            .toHaveBeenNthCalledWith(2, "driver-1", "AVAILABLE");
        expect(driverReservations.size).toBe(0);
    });

    test("does not dispatch without an available driver", async () => {
        orders.set("order-none", makeOrder("order-none"));

        const result = await dispatchOrder("order-none");

        expect(result).toMatchObject({
            status: "WAITING_FOR_DRIVER",
            reason: "NO_DRIVER_IN_ZONE",
        });
        expect(waitingOrders.get(ZONE_ID)?.has("order-none"))
            .toBe(true);
    });
});
