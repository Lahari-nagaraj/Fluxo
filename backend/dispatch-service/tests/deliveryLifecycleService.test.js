jest.mock("../src/clients/orderClient", () => ({
    updateOrderStatus: jest.fn().mockResolvedValue({ status: "OK" }),
}));

jest.mock("../src/clients/driverClient", () => ({
    updateDriverStatus: jest.fn().mockResolvedValue({ status: "OK" }),
    getAllDrivers: jest.fn().mockResolvedValue([]),
}));

jest.mock("../src/clients/redisClient", () => ({
    redisClient: {
        hSet: jest.fn().mockResolvedValue("OK"),
        hGetAll: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue("OK"),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        sRem: jest.fn().mockResolvedValue(1),
        sMembers: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock("../src/config/config", () => ({
    simulationMinuteMs: 10, // Fast 10ms per simulated minute for testing
}));

const orderClient = require("../src/clients/orderClient");
const driverClient = require("../src/clients/driverClient");
const { redisClient } = require("../src/clients/redisClient");
const {
    startDeliveryLifecycle,
    getAssignment,
    getActiveAssignments,
    resetStuckDrivers,
} = require("../src/services/deliveryLifecycleService");

describe("Delivery Lifecycle Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("progresses order through PICKED_UP -> IN_TRANSIT -> DELIVERED and restores driver to AVAILABLE", async () => {
        const orderId = "order-test-123";
        const driverId = "driver-test-456";

        startDeliveryLifecycle(orderId, driverId);

        // Wait enough time for simulated lifecycle to finish (max 5*10ms + 12*10ms = 170ms)
        await new Promise((resolve) => setTimeout(resolve, 300));

        // 1. Verify PICKED_UP was called
        expect(orderClient.updateOrderStatus).toHaveBeenCalledWith(
            orderId,
            "PICKED_UP"
        );

        // 2. Verify IN_TRANSIT was called
        expect(orderClient.updateOrderStatus).toHaveBeenCalledWith(
            orderId,
            "IN_TRANSIT"
        );

        // 3. Verify DELIVERED was called
        expect(orderClient.updateOrderStatus).toHaveBeenCalledWith(
            orderId,
            "DELIVERED"
        );

        // 4. Verify Driver was marked AVAILABLE at completion
        expect(driverClient.updateDriverStatus).toHaveBeenCalledWith(
            driverId,
            "AVAILABLE"
        );

        // 5. Verify Redis assignment cleanup
        expect(redisClient.del).toHaveBeenCalledWith(`driver:order:${driverId}`);
        expect(redisClient.del).toHaveBeenCalledWith(`order:driver:${orderId}`);
        expect(redisClient.sRem).toHaveBeenCalledWith("orders:active_assignments", orderId);
    });

    test("resetStuckDrivers restores busy drivers with no active order timer", async () => {
        driverClient.getAllDrivers.mockResolvedValueOnce([
            { driver_id: "driver-busy-1", status: "BUSY" },
            { driver_id: "driver-avail", status: "AVAILABLE" },
        ]);

        const result = await resetStuckDrivers();

        expect(result.resetCount).toBe(1);
        expect(result.resetDriverIds).toContain("driver-busy-1");
        expect(driverClient.updateDriverStatus).toHaveBeenCalledWith(
            "driver-busy-1",
            "AVAILABLE"
        );
    });
});
