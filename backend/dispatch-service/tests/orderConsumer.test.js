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

describe("OrderCreated consumer", () => {
    let eachMessage;

    beforeEach(async () => {
        jest.clearAllMocks();
        consumer.connect.mockResolvedValue();
        consumer.subscribe.mockResolvedValue();
        consumer.run.mockImplementation(async ({ eachMessage: handler }) => {
            eachMessage = handler;
        });

        await startOrderConsumer();
    });

    test("dispatches OrderCreated and treats a waiting order as a completed event", async () => {
        dispatchOrder.mockResolvedValue({
            status: "WAITING_FOR_DRIVER",
            reason: "NO_VALID_DRIVER_LOCATION",
        });

        await expect(eachMessage({
            topic: "orders",
            partition: 0,
            message: {
                value: Buffer.from(JSON.stringify({
                    eventType: "OrderCreated",
                    orderId: "order-1",
                })),
            },
        })).resolves.toBeUndefined();

        expect(dispatchOrder).toHaveBeenCalledWith("order-1");
    });

    test("propagates transient dispatch errors for Kafka retry", async () => {
        const error = new Error("temporary Redis failure");
        dispatchOrder.mockRejectedValue(error);

        await expect(eachMessage({
            topic: "orders",
            partition: 0,
            message: {
                value: Buffer.from(JSON.stringify({
                    eventType: "OrderCreated",
                    orderId: "order-2",
                })),
            },
        })).rejects.toBe(error);
    });

    test("ignores unrelated events", async () => {
        await eachMessage({
            topic: "orders",
            partition: 0,
            message: {
                value: Buffer.from(JSON.stringify({
                    eventType: "OrderUpdated",
                    orderId: "order-3",
                })),
            },
        });

        expect(dispatchOrder).not.toHaveBeenCalled();
    });
});
