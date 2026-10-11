jest.mock("../src/clients/redisClient", () => ({
    redisClient: {
        hGetAll: jest.fn(),
        hSet: jest.fn(),
        sAdd: jest.fn(),
        sRem: jest.fn(),
        ttl: jest.fn(),
    },
}));

jest.mock("../src/repositories/driverRepository", () => ({
    findById: jest.fn(),
    updateStatus: jest.fn(),
}));

jest.mock("../src/config/kafka", () => ({
    publishDriverAvailable: jest.fn(),
}));

const { redisClient } = require("../src/clients/redisClient");
const driverRepository = require("../src/repositories/driverRepository");
const { publishDriverAvailable } = require("../src/config/kafka");
const { updateDriverStatus } = require("../src/services/driverService");

describe("Driver availability zone indexing", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        driverRepository.findById.mockResolvedValue({
            driver_id: "driver-1",
            status: "BUSY",
            zone_id: "ZONE_OLD",
        });
        driverRepository.updateStatus.mockResolvedValue({
            driver_id: "driver-1",
            status: "AVAILABLE",
            zone_id: "ZONE_OLD",
        });
        redisClient.hGetAll.mockImplementation(async (key) => {
            if (key === "driver:driver-1") {
                return {
                    status: "BUSY",
                    zoneId: "ZONE_CURRENT",
                };
            }
            return {
                zoneId: "ZONE_CURRENT",
                updatedAt: new Date().toISOString(),
            };
        });
        redisClient.ttl.mockResolvedValue(45);
    });

    test("keeps the available set and emitted event aligned with the fresh Redis location zone", async () => {
        await updateDriverStatus("driver-1", "AVAILABLE");

        expect(redisClient.sAdd).toHaveBeenCalledWith(
            "drivers:available",
            "driver-1"
        );
        expect(redisClient.sRem).toHaveBeenCalledWith(
            "drivers:available:ZONE_OLD",
            "driver-1"
        );
        expect(redisClient.sAdd).toHaveBeenCalledWith(
            "drivers:available:ZONE_CURRENT",
            "driver-1"
        );
        expect(redisClient.hSet).toHaveBeenCalledWith(
            "driver:driver-1",
            expect.objectContaining({
                status: "AVAILABLE",
                zoneId: "ZONE_CURRENT",
            })
        );
        expect(publishDriverAvailable).toHaveBeenCalledWith(
            expect.objectContaining({
                driver_id: "driver-1",
                zone_id: "ZONE_CURRENT",
            })
        );
    });
});
