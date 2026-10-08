jest.mock("../src/config/kafka", () => ({
    consumer: {
        connect: jest.fn(),
        run: jest.fn(),
        subscribe: jest.fn(),
    },
}));

jest.mock("../src/services/dispatchService", () => ({
    dispatchOrder: jest.fn(),
}));

const { consumer } = require("../src/config/kafka");
const { dispatchOrder } = require("../src/services/dispatchService");
const {
    startOrderConsumer,
} = require("../src/events/orderConsumer");

describe("Order consumer dispatch retries", () => {
    let eachMessage;

    beforeEach(async () => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        consumer.connect.mockResolvedValue();
        consumer.subscribe.mockResolvedValue();
        consumer.run.mockImplementation(async (options) => {
            eachMessage = options.eachMessage;
        });

        await startOrderConsumer();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test("schedules a retry for a dispatch conflict without failing the Kafka message handler", async () => {
        const unavailableError = new Error(
            "No drivers with fresh locations"
        );
        unavailableError.statusCode = 409;

        dispatchOrder
            .mockRejectedValueOnce(unavailableError)
            .mockResolvedValueOnce({
                status: "ASSIGNED",
            });

        await expect(
            eachMessage({
                topic: "orders",
                partition: 0,
                message: {
                    value: Buffer.from(JSON.stringify({
                        eventType: "OrderCreated",
                        orderId: "order-1",
                    })),
                },
            })
        ).resolves.toBeUndefined();

        expect(dispatchOrder)
            .toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(5000);

        expect(dispatchOrder)
            .toHaveBeenCalledTimes(2);
    });

    test("continues retrying while dispatch remains unavailable", async () => {
        const unavailableError = new Error(
            "No drivers with fresh locations"
        );
        unavailableError.statusCode = 409;

        dispatchOrder.mockRejectedValue(
            unavailableError
        );

        await eachMessage({
            topic: "orders",
            partition: 0,
            message: {
                value: Buffer.from(JSON.stringify({
                    eventType: "OrderCreated",
                    orderId: "order-2",
                })),
            },
        });

        await jest.advanceTimersByTimeAsync(5000);
        expect(dispatchOrder)
            .toHaveBeenCalledTimes(2);

        await jest.advanceTimersByTimeAsync(10000);
        expect(dispatchOrder)
            .toHaveBeenCalledTimes(3);
    });
});
