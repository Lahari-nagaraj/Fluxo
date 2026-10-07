const request = require("supertest");

const app = require("../src/app");

describe("Location Service", () => {

    test(
        "GET /health should return service health",
        async () => {

            const response =
                await request(app)
                    .get("/health");

            expect(
                response.statusCode
            ).toBe(200);

            expect(
                response.body
            ).toEqual({
                success: true,
                service: "location-service",
                status: "UP",
            });
        }
    );

    test(
        "POST /locations should reject invalid latitude",
        async () => {

            const response =
                await request(app)
                    .post("/locations")
                    .send({
                        driverId:
                            "test-driver",
                        latitude: 200,
                        longitude: 77.5,
                        zoneId: "ZONE_A",
                    });

            expect(
                response.statusCode
            ).toBe(400);
        }
    );

});