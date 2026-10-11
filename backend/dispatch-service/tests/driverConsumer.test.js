const mockConsumer = {
    connect: jest.fn(),
    subscribe: jest.fn(),
    run: jest.fn(),
};

jest.mock("kafkajs", () => ({
    Kafka: jest.fn().mockImplementation(() => ({
        consumer: jest.fn(() => mockConsumer),
    })),
}));

jest.mock("../src/services/dispatchService", () => ({
    dispatchOrder: jest.fn(),
}));

jest.mock("../src/clients/redisClient", () => ({
    redisClient: {
        hGetAll: jest.fn(),
    },
    getWaitingOrders: jest.fn(),
    getWaitingZones: jest.fn(),
    removeWaitingOrder: jest.fn(),
}));

const { dispatchOrder } = require("../src/services/dispatchService");
const redis = require("../src/clients/redisClient");
const {
    startDriverConsumer,
    recoverWaitingOrders,
    stopDriverRecovery,
} = require("../src/events/driverConsumer");

describe("Dispatch waiting-order recovery", () => {
    let eachMessage;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConsumer.connect.mockResolvedValue();
        mockConsumer.subscribe.mockResolvedValue();
        mockConsumer.run.mockImplementation(async ({ eachMessage: handler }) => {
            eachMessage = handler;
        });
        redis.getWaitingZones.mockResolvedValue([]);
        redis.getWaitingOrders.mockResolvedValue([]);
        redis.removeWaitingOrder.mockResolvedValue(1);
        redis.redisClient.hGetAll.mockResolvedValue({});
    });

    afterEach(() => {
        stopDriverRecovery();
        jest.useRealTimers();
    });

    test("retries an order in the zone from DriverAvailable", async () => {
        redis.redisClient.hGetAll.mockImplementation(
            async (key) => key.startsWith("driver:location:")
                ? { zoneId: "ZONE_2059_5151" }
                : {}
        );
        redis.getWaitingOrders.mockResolvedValue(["order-waiting"]);
        dispatchOrder.mockResolvedValue({
            status: "ASSIGNED",
        });

        await startDriverConsumer();
        await eachMessage({
            message: {
                value: Buffer.from(JSON.stringify({
                    eventType: "DriverAvailable",
                    driverId: "driver-1",
                    zoneId: "ZONE_OLD",
                })),
            },
        });

        expect(redis.getWaitingOrders)
            .toHaveBeenCalledWith("ZONE_2059_5151");
        expect(dispatchOrder)
            .toHaveBeenCalledWith("order-waiting");
        expect(redis.removeWaitingOrder)
            .toHaveBeenCalledWith("order-waiting", "ZONE_2059_5151");
    });

    test("startup scans persisted waiting sets so a missed event does not strand orders", async () => {
        redis.getWaitingZones.mockResolvedValue([
            "ZONE_2059_5151",
        ]);
        redis.getWaitingOrders.mockResolvedValue([
            "order-after-restart",
        ]);
        dispatchOrder.mockResolvedValue({
            status: "SKIPPED",
        });

        await startDriverConsumer();

        expect(redis.getWaitingZones).toHaveBeenCalledTimes(1);
        expect(dispatchOrder)
            .toHaveBeenCalledWith("order-after-restart");
        expect(redis.removeWaitingOrder)
            .toHaveBeenCalledWith(
                "order-after-restart",
                "ZONE_2059_5151"
            );
        expect(mockConsumer.subscribe).toHaveBeenCalledWith({
            topic: "drivers",
            fromBeginning: false,
        });
    });

    test("periodically retries persisted orders after location refresh without another availability event", async () => {
        jest.useFakeTimers();
        await startDriverConsumer();
        jest.clearAllMocks();

        redis.getWaitingZones.mockResolvedValue([
            "ZONE_2059_5151",
        ]);
        redis.getWaitingOrders.mockResolvedValue([
            "order-location-refreshed",
        ]);
        dispatchOrder.mockResolvedValue({
            status: "ASSIGNED",
        });

        await jest.advanceTimersByTimeAsync(10_000);

        expect(redis.getWaitingZones).toHaveBeenCalled();
        expect(dispatchOrder)
            .toHaveBeenCalledWith("order-location-refreshed");
    });

    test("leaves orders in the waiting set after transient failures", async () => {
        redis.getWaitingZones.mockResolvedValue(["ZONE_2059_5151"]);
        redis.getWaitingOrders.mockResolvedValue(["order-retry"]);
        dispatchOrder.mockRejectedValue(
            new Error("temporary order service failure")
        );

        await recoverWaitingOrders();

        expect(dispatchOrder).toHaveBeenCalledWith("order-retry");
        expect(redis.removeWaitingOrder).not.toHaveBeenCalled();
    });
});
