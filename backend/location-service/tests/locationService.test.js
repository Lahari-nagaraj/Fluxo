jest.mock("../src/repositories/locationRepository");
jest.mock("../src/clients/redisClient", () => ({
    redisClient: {
        expire: jest.fn(),
        hGetAll: jest.fn(),
        hSet: jest.fn(),
        sAdd: jest.fn(),
        sRem: jest.fn(),
    },
}));

const locationRepository = require("../src/repositories/locationRepository");
const { redisClient } = require("../src/clients/redisClient");
const locationService = require("../src/services/locationService");

describe("Location Service zone indexing", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        locationRepository.upsertLocation
            .mockResolvedValue({
                driver_id: "driver-1",
                latitude: 12.9716,
                longitude: 77.5946,
            });
        redisClient.hGetAll.mockResolvedValue({
            status: "AVAILABLE",
            zoneId: "ZONE_A",
        });
        redisClient.hSet.mockResolvedValue(1);
        redisClient.expire.mockResolvedValue(1);
        redisClient.sAdd.mockResolvedValue(1);
        redisClient.sRem.mockResolvedValue(1);
    });

    test("persists and indexes the zone calculated from the driver's coordinates", async () => {
        await locationService.updateLocation({
            driverId: "driver-1",
            latitude: 12.9716,
            longitude: 77.5946,
            zoneId: "ZONE_A",
        });

        expect(locationRepository.upsertLocation)
            .toHaveBeenCalledWith({
                driverId: "driver-1",
                latitude: 12.9716,
                longitude: 77.5946,
                zoneId: "ZONE_2059_5151",
            });
        expect(redisClient.sRem).toHaveBeenCalledWith(
            "drivers:available:ZONE_A",
            "driver-1"
        );
        expect(redisClient.sAdd).toHaveBeenCalledWith(
            "drivers:available:ZONE_2059_5151",
            "driver-1"
        );
    });
});
