const request = require("supertest");

jest.mock("../src/clients/driverClient");
jest.mock("../src/clients/locationClient");
jest.mock("../src/clients/orderClient");

const driverClient = require("../src/clients/driverClient");
const locationClient = require("../src/clients/locationClient");
const orderClient = require("../src/clients/orderClient");

const app = require("../src/app");

describe("Dispatch Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("GET /health should return service health", async () => {
        const response = await request(app)
            .get("/health");

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            success: true,
            service: "dispatch-service",
            status: "UP",
        });
    });

    test("should assign the closest available driver", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-1",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "CREATED",
        });

        orderClient.updateOrderStatus
            .mockResolvedValue({
                order_id: "order-1",
                status: "ASSIGNED",
            });

        driverClient.getAvailableDrivers
            .mockResolvedValue([
                {
                    driver_id: "driver-1",
                    name: "Far Driver",
                },
                {
                    driver_id: "driver-2",
                    name: "Close Driver",
                },
            ]);

        locationClient.getDriverLocation
            .mockImplementation(async (driverId) => {
                if (driverId === "driver-1") {
                    return {
                        latitude: 13.0500,
                        longitude: 77.7000,
                    };
                }

                return {
                    latitude: 12.9720,
                    longitude: 77.5950,
                };
            });

        driverClient.updateDriverStatus
            .mockResolvedValue({
                driver_id: "driver-2",
                status: "BUSY",
            });

        const response = await request(app)
            .post("/dispatch/orders/order-1/dispatch");

        expect(response.statusCode).toBe(200);

        expect(
            driverClient.updateDriverStatus
        ).toHaveBeenCalledWith(
            "driver-2",
            "BUSY"
        );

        expect(
            orderClient.updateOrderStatus
        ).toHaveBeenCalledWith(
            "order-1",
            "SEARCHING_DRIVER"
        );

        expect(
            orderClient.updateOrderStatus
        ).toHaveBeenCalledWith(
            "order-1",
            "ASSIGNED"
        );

        expect(response.body.success).toBe(true);

        expect(
            response.body.data.driver.driver_id
        ).toBe("driver-2");
    });

    test("should return 409 when no drivers are available", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-2",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "CREATED",
        });

        orderClient.updateOrderStatus
            .mockResolvedValue({
                order_id: "order-2",
                status: "SEARCHING_DRIVER",
            });

        driverClient.getAvailableDrivers
            .mockResolvedValue([]);

        const response = await request(app)
            .post("/dispatch/orders/order-2/dispatch");

        expect(response.statusCode).toBe(409);

        expect(response.body.message)
            .toBe("No available drivers");
    });

    test("should return 409 when drivers have no valid locations", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-3",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "CREATED",
        });

        orderClient.updateOrderStatus
            .mockResolvedValue({
                order_id: "order-3",
                status: "SEARCHING_DRIVER",
            });

        driverClient.getAvailableDrivers
            .mockResolvedValue([
                {
                    driver_id: "driver-1",
                },
            ]);

        locationClient.getDriverLocation
            .mockRejectedValue(
                new Error("Location not found")
            );

        const response = await request(app)
            .post("/dispatch/orders/order-3/dispatch");

        expect(response.statusCode).toBe(409);

        expect(response.body.message)
            .toBe(
                "No drivers with valid locations available"
            );
    });

    test("should reject an already assigned order", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-4",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "ASSIGNED",
        });

        const response = await request(app)
            .post("/dispatch/orders/order-4/dispatch");

        expect(response.statusCode).toBe(400);

        expect(response.body.message)
            .toBe(
                "Order cannot be dispatched from status ASSIGNED"
            );

        expect(
            driverClient.getAvailableDrivers
        ).not.toHaveBeenCalled();
    });
});