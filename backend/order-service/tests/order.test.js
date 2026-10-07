const request = require("supertest");

const app = require("../src/app");

describe("Order Service", () => {
    test("GET /health should return service health", async () => {
        const response = await request(app)
            .get("/health");

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            success: true,
            service: "order-service",
            status: "UP",
        });
    });
});