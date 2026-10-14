
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());

const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

// Existing client-facing microservices
const services = [
    {
        name: "Order Service",
        prefix: "/api/orders",
        target: process.env.ORDER_SERVICE_URL || (isProduction ? "https://fluxo-order-service.onrender.com" : "http://localhost:3001"),
        servicePrefix: "/orders",
    },
    {
        name: "Driver Service",
        prefix: "/api/drivers",
        target: process.env.DRIVER_SERVICE_URL || (isProduction ? "https://fluxo-driver-service.onrender.com" : "http://localhost:3002"),
        servicePrefix: "/drivers",
    },
    {
        name: "Location Service",
        prefix: "/api/locations",
        target: process.env.LOCATION_SERVICE_URL || (isProduction ? "https://fluxo-location-service.onrender.com" : "http://localhost:3003"),
        servicePrefix: "/locations",
    },
    {
        name: "Dispatch Service",
        prefix: "/api/dispatch",
        target: process.env.DISPATCH_SERVICE_URL || (isProduction ? "https://fluxo-dispatch-service.onrender.com" : "http://localhost:3004"),
        servicePrefix: "/dispatch",
    },
];

// Validate required service URLs
for (const service of services) {
    if (!service.target) {
        throw new Error(
            `Missing environment variable for ${service.name}`
        );
    }
}

// Gateway health check
app.get("/health", (req, res) => {
    res.status(200).json({
        service: "api-gateway",
        status: "healthy",
    });
});

// Register HTTP proxies
for (const service of services) {
    app.use(
        service.prefix,
        createProxyMiddleware({
            target: service.target,
            changeOrigin: true,

            // Map the gateway prefix to the existing service prefix.
            pathRewrite: (path) =>
                `${service.servicePrefix}${
                    path === "/" ? "" : path
                }`,

            on: {
                error: (error, req, res) => {
                    console.error(
                        `[Gateway] ${service.name} proxy error:`,
                        error.message
                    );

                    if (!res.headersSent && !res.destroyed) {
                        res.writeHead(502, {
                            "Content-Type": "application/json",
                        });

                        res.end(
                            JSON.stringify({
                                success: false,
                                message: `${service.name} is currently unavailable`,
                            })
                        );
                    }
                },
            },
        })
    );

    console.log(
        `[Gateway] ${service.prefix} -> ${service.target}`
    );
}

// Unknown gateway routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Gateway route not found",
        path: req.originalUrl,
    });
});

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});
