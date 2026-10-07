const request = require("supertest");

const app = require("../src/app");

describe("Driver Service", () => {

    test("GET /health should return service health", async () => {
        const response = await request(app)
            .get("/health");

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            success: true,
            service: "driver-service",
            status: "UP",
        });
    });

    test("GET /drivers/available should return an array", async () => {
        const response = await request(app)
            .get("/drivers/available");

        expect(response.statusCode).toBe(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });

});