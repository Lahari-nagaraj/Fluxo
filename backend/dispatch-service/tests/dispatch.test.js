const request = require("supertest");

jest.mock("../src/clients/driverClient");
jest.mock("../src/clients/locationClient");
jest.mock("../src/clients/orderClient");
jest.mock("../src/clients/redisClient", () => ({
    redisClient: {
        expire: jest.fn(),
        hGetAll: jest.fn(),
        hSet: jest.fn(),
        sAdd: jest.fn(),
        sMembers: jest.fn(),
        sRem: jest.fn(),
    },
}));

const driverClient = require("../src/clients/driverClient");
const locationClient = require("../src/clients/locationClient");
const orderClient = require("../src/clients/orderClient");
const { redisClient } = require("../src/clients/redisClient");

const app = require("../src/app");

const freshLocation = (latitude, longitude) => ({
    latitude,
    longitude,
    updated_at: new Date().toISOString(),
});

describe("Dispatch Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        redisClient.hGetAll.mockResolvedValue({});
        redisClient.hSet.mockResolvedValue(1);
        redisClient.expire.mockResolvedValue(1);
        redisClient.sMembers.mockResolvedValue([]);
        redisClient.sRem.mockResolvedValue(1);
        redisClient.sAdd.mockResolvedValue(1);

        driverClient.getAvailableDrivers
            .mockResolvedValue([]);
        driverClient.updateDriverStatus
            .mockResolvedValue({
                status: "BUSY",
            });

        orderClient.updateOrderStatus
            .mockImplementation(async (orderId, status) => ({
                order_id: orderId,
                status,
            }));
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

    test("should assign the closest available driver using persisted locations when Redis is empty", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-1",
            pickup_zone_id: "ZONE_2059_5151",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "CREATED",
        });

        driverClient.getAvailableDrivers.mockResolvedValue([
            {
                driver_id: "driver-1",
                status: "AVAILABLE",
            },
            {
                driver_id: "driver-2",
                status: "AVAILABLE",
            },
        ]);

        locationClient.getDriverLocation
            .mockImplementation(async (driverId) => {
                if (driverId === "driver-1") {
                    return freshLocation(12.99, 77.59);
                }

                return freshLocation(12.972, 77.595);
            });

        const response = await request(app)
            .post("/dispatch/orders/order-1/dispatch");

        expect(response.statusCode).toBe(200);
        expect(locationClient.getDriverLocation)
            .toHaveBeenCalledTimes(2);
        expect(redisClient.hSet).toHaveBeenCalledWith(
            "driver:location:driver-2",
            {
                latitude: "12.972",
                longitude: "77.595",
            }
        );
        expect(redisClient.expire).toHaveBeenCalledWith(
            "driver:location:driver-2",
            60
        );
        expect(driverClient.updateDriverStatus)
            .toHaveBeenCalledWith("driver-2", "BUSY");
        expect(redisClient.sAdd).toHaveBeenCalledWith(
            "drivers:available:ZONE_2059_5151",
            "driver-2"
        );
        expect(orderClient.updateOrderStatus)
            .toHaveBeenNthCalledWith(
                1,
                "order-1",
                "SEARCHING_DRIVER"
            );
        expect(orderClient.updateOrderStatus)
            .toHaveBeenNthCalledWith(
                2,
                "order-1",
                "ASSIGNED"
            );
        expect(response.body.success).toBe(true);
        expect(response.body.data.driver.driver_id)
            .toBe("driver-2");
    });

    test("should use cached locations when they are available", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-cached",
            pickup_zone_id: "ZONE_2040_5140",
            pickup_latitude: 12,
            pickup_longitude: 77,
            status: "SEARCHING_DRIVER",
        });

        driverClient.getAvailableDrivers.mockResolvedValue([
            {
                driver_id: "driver-1",
                status: "AVAILABLE",
            },
        ]);
        redisClient.hGetAll.mockResolvedValue({
            latitude: "12",
            longitude: "77",
        });

        const response = await request(app)
            .post("/dispatch/orders/order-cached/dispatch");

        expect(response.statusCode).toBe(200);
        expect(locationClient.getDriverLocation)
            .not.toHaveBeenCalled();
        expect(driverClient.updateDriverStatus)
            .toHaveBeenCalledWith("driver-1", "BUSY");
    });

    test("should return 409 when no drivers are available", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-2",
            pickup_zone_id: "zone-2",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "CREATED",
        });

        const response = await request(app)
            .post("/dispatch/orders/order-2/dispatch");

        expect(response.statusCode).toBe(409);
        expect(response.body.message)
            .toBe("No available drivers in zone zone-2");
    });

    test("should remove drivers with no persisted location from the zone index", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-3",
            pickup_zone_id: "ZONE_2059_5151",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "SEARCHING_DRIVER",
        });

        driverClient.getAvailableDrivers.mockResolvedValue([
            {
                driver_id: "driver-missing-location",
                status: "AVAILABLE",
            },
            {
                driver_id: "driver-stale-location",
                status: "AVAILABLE",
            },
        ]);
        locationClient.getDriverLocation.mockRejectedValue({
            response: {
                status: 404,
            },
            });

        const response = await request(app)
            .post("/dispatch/orders/order-3/dispatch");

        expect(response.statusCode).toBe(409);
        expect(response.body.message)
            .toBe(
                "No drivers with fresh locations in zone ZONE_2059_5151"
            );
        expect(redisClient.sRem).toHaveBeenCalledWith(
            "drivers:available:ZONE_2059_5151",
            "driver-missing-location"
        );
        expect(driverClient.updateDriverStatus)
            .not.toHaveBeenCalled();
    });

    test("should dispatch using a persisted location when the Redis cache has expired", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-persisted-location",
            pickup_zone_id: "ZONE_2059_5151",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "SEARCHING_DRIVER",
        });

        driverClient.getAvailableDrivers.mockResolvedValue([
            {
                driver_id: "driver-with-persisted-location",
                status: "AVAILABLE",
            },
        ]);
        locationClient.getDriverLocation.mockResolvedValue({
            latitude: 12.972,
            longitude: 77.595,
            updated_at: new Date(
                Date.now() - 5 * 60 * 1000
            ).toISOString(),
        });

        const response = await request(app)
            .post(
                "/dispatch/orders/order-persisted-location/dispatch"
            );

        expect(response.statusCode).toBe(200);
        expect(redisClient.hSet).toHaveBeenCalledWith(
            "driver:location:driver-with-persisted-location",
            {
                latitude: "12.972",
                longitude: "77.595",
            }
        );
        expect(driverClient.updateDriverStatus)
            .toHaveBeenCalledWith(
                "driver-with-persisted-location",
                "BUSY"
            );
        expect(response.body.data.driver.driver_id)
            .toBe("driver-with-persisted-location");
    });

    test("should try the next driver if the closest driver was claimed concurrently", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-4",
            pickup_zone_id: "ZONE_2040_5140",
            pickup_latitude: 12,
            pickup_longitude: 77,
            status: "SEARCHING_DRIVER",
        });

        driverClient.getAvailableDrivers.mockResolvedValue([
            {
                driver_id: "driver-closest",
                status: "AVAILABLE",
            },
            {
                driver_id: "driver-next",
                status: "AVAILABLE",
            },
        ]);
        locationClient.getDriverLocation
            .mockImplementation(async (driverId) => {
                if (driverId === "driver-closest") {
                    return freshLocation(12.001, 77);
                }

                return freshLocation(12.01, 77);
            });
        driverClient.updateDriverStatus
            .mockImplementation(async (driverId) => {
                if (driverId === "driver-closest") {
                    const error = new Error(
                        "Driver is no longer available"
                    );

                    error.response = {
                        status: 409,
                    };

                    throw error;
                }

                return {
                    driver_id: driverId,
                    status: "BUSY",
                };
            });

        const response = await request(app)
            .post("/dispatch/orders/order-4/dispatch");

        expect(response.statusCode).toBe(200);
        expect(driverClient.updateDriverStatus)
            .toHaveBeenNthCalledWith(
                1,
                "driver-closest",
                "BUSY"
            );
        expect(driverClient.updateDriverStatus)
            .toHaveBeenNthCalledWith(
                2,
                "driver-next",
                "BUSY"
            );
        expect(redisClient.sRem).toHaveBeenCalledWith(
            "drivers:available:ZONE_2040_5140",
            "driver-closest"
        );
        expect(response.body.data.driver.driver_id)
            .toBe("driver-next");
    });

    test("should find drivers in the pickup zone when the Redis zone set is empty", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-redis-empty",
            pickup_zone_id: "ZONE_2059_5151",
            pickup_latitude: 12.9716,
            pickup_longitude: 77.5946,
            status: "SEARCHING_DRIVER",
        });

        driverClient.getAvailableDrivers.mockResolvedValue([
            {
                driver_id: "driver-in-zone",
                status: "AVAILABLE",
            },
            {
                driver_id: "driver-other-zone",
                status: "AVAILABLE",
            },
        ]);
        locationClient.getDriverLocation
            .mockImplementation(async (driverId) => {
                if (driverId === "driver-in-zone") {
                    return freshLocation(12.972, 77.595);
                }

                return freshLocation(13.1, 77.7);
            });

        const response = await request(app)
            .post(
                "/dispatch/orders/order-redis-empty/dispatch"
            );

        expect(response.statusCode).toBe(200);
        expect(driverClient.updateDriverStatus)
            .toHaveBeenCalledTimes(1);
        expect(driverClient.updateDriverStatus)
            .toHaveBeenCalledWith(
                "driver-in-zone",
                "BUSY"
            );
        expect(redisClient.sAdd).toHaveBeenCalledWith(
            "drivers:available:ZONE_2059_5151",
            "driver-in-zone"
        );
        expect(redisClient.sRem).toHaveBeenCalledWith(
            "drivers:available:ZONE_2059_5151",
            "driver-in-zone"
        );
        expect(redisClient.sRem).toHaveBeenCalledWith(
            "drivers:available:ZONE_2059_5151",
            "driver-other-zone"
        );
        expect(response.body.data.driver.driver_id)
            .toBe("driver-in-zone");
    });

    test("should not dispatch an already assigned order again", async () => {
        orderClient.getOrder.mockResolvedValue({
            order_id: "order-5",
            status: "ASSIGNED",
        });

        const response = await request(app)
            .post("/dispatch/orders/order-5/dispatch");

        expect(response.statusCode).toBe(200);
        expect(response.body.data.alreadyProcessed)
            .toBe(true);
        expect(driverClient.getAvailableDrivers)
            .not.toHaveBeenCalled();
        expect(driverClient.updateDriverStatus)
            .not.toHaveBeenCalled();
    });
});
