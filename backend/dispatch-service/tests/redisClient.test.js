const mockRedisClient = {
    on: jest.fn(),
    set: jest.fn(),
    eval: jest.fn(),
    sMembers: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    scanIterator: jest.fn(),
};

jest.mock("redis", () => ({
    createClient: jest.fn(() => mockRedisClient),
}));

const {
    reserveDriver,
    releaseDriverReservation,
    reserveOrderDispatch,
    releaseOrderDispatch,
    getWaitingZones,
} = require("../src/clients/redisClient");

describe("Dispatch Redis coordination", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisClient.set.mockResolvedValue("OK");
        mockRedisClient.eval.mockResolvedValue(1);
    });

    test("reserves drivers with unique tokens and releases only the matching owner atomically", async () => {
        const reservationToken =
            await reserveDriver("driver-1", "order-1");

        expect(reservationToken).toMatch(/^order-1:/);
        expect(mockRedisClient.set).toHaveBeenCalledWith(
            "driver:reservation:driver-1",
            reservationToken,
            {
                NX: true,
                EX: 120,
            }
        );

        await expect(
            releaseDriverReservation("driver-1", reservationToken)
        ).resolves.toBe(true);

        const [script, options] =
            mockRedisClient.eval.mock.calls[0];
        expect(script).toContain(
            'redis.call("GET", KEYS[1]) == ARGV[1]'
        );
        expect(options).toEqual({
            keys: ["driver:reservation:driver-1"],
            arguments: [reservationToken],
        });
    });

    test("uses an atomic per-order lock", async () => {
        const token =
            await reserveOrderDispatch("order-1");

        expect(token).toBeTruthy();
        expect(mockRedisClient.set).toHaveBeenCalledWith(
            "dispatch:reservation:order-1",
            token,
            {
                NX: true,
                EX: 120,
            }
        );
        await expect(
            releaseOrderDispatch("order-1", token)
        ).resolves.toBe(true);
    });

    test("discovers persisted waiting-order zones with Redis SCAN", async () => {
        mockRedisClient.scanIterator.mockImplementation(
            async function* () {
                yield [
                    "dispatch:waiting:ZONE_A",
                    "dispatch:waiting:ZONE_B",
                ];
            }
        );

        await expect(getWaitingZones())
            .resolves.toEqual(["ZONE_A", "ZONE_B"]);
        expect(mockRedisClient.scanIterator)
            .toHaveBeenCalledWith({
                MATCH: "dispatch:waiting:*",
                COUNT: 100,
            });
    });
});
