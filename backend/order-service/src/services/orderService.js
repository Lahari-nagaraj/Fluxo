const crypto = require("crypto");
const { getZoneId } = require("../utils/zone");
const orderRepository = require("../repositories/orderRepository");

const {
    ORDER_STATUS,
    ORDER_PRIORITY,
} = require("../models/orderModel");

const {
    publishOrderCreated,
} = require("../events/orderProducer");

const VALID_STATUS_TRANSITIONS = {
    [ORDER_STATUS.CREATED]: [
        ORDER_STATUS.SEARCHING_DRIVER,
        ORDER_STATUS.CANCELLED,
    ],

    [ORDER_STATUS.SEARCHING_DRIVER]: [
        ORDER_STATUS.ASSIGNED,
        ORDER_STATUS.CANCELLED,
    ],

    [ORDER_STATUS.ASSIGNED]: [
        ORDER_STATUS.PICKED_UP,
        ORDER_STATUS.SEARCHING_DRIVER,
        ORDER_STATUS.CANCELLED,
    ],

    [ORDER_STATUS.PICKED_UP]: [
        ORDER_STATUS.IN_TRANSIT,
    ],

    [ORDER_STATUS.IN_TRANSIT]: [
        ORDER_STATUS.DELIVERED,
    ],

    [ORDER_STATUS.DELIVERED]: [],

    [ORDER_STATUS.CANCELLED]: [],
};

function validateCreateOrder(data) {
    const requiredFields = [
        "customerId",
        "pickupLatitude",
        "pickupLongitude",
        "deliveryLatitude",
        "deliveryLongitude",
    ];

    for (const field of requiredFields) {
        if (data[field] === undefined || data[field] === null) {
            throw new Error(`${field} is required`);
        }
    }

    const coordinates = [
        data.pickupLatitude,
        data.pickupLongitude,
        data.deliveryLatitude,
        data.deliveryLongitude,
    ];

    if (coordinates.some((value) => typeof value !== "number")) {
        throw new Error("Coordinates must be numbers");
    }

    if (
        data.pickupLatitude < -90 ||
        data.pickupLatitude > 90 ||
        data.deliveryLatitude < -90 ||
        data.deliveryLatitude > 90
    ) {
        throw new Error("Latitude must be between -90 and 90");
    }

    if (
        data.pickupLongitude < -180 ||
        data.pickupLongitude > 180 ||
        data.deliveryLongitude < -180 ||
        data.deliveryLongitude > 180
    ) {
        throw new Error("Longitude must be between -180 and 180");
    }

    if (
        data.priority &&
        !Object.values(ORDER_PRIORITY).includes(data.priority)
    ) {
        throw new Error("Invalid priority");
    }
}

async function createOrder(data) {
    // 1. Validate request
    validateCreateOrder(data);

    // 2. Calculate pickup zone
    const pickupZoneId = getZoneId(
        data.pickupLatitude,
        data.pickupLongitude
    );

    // 3. Build order object
    const order = {
        orderId: crypto.randomUUID(),
        customerId: data.customerId,

        pickupLatitude: data.pickupLatitude,
        pickupLongitude: data.pickupLongitude,
        pickupZoneId: pickupZoneId,

        deliveryLatitude: data.deliveryLatitude,
        deliveryLongitude: data.deliveryLongitude,

        priority: data.priority || ORDER_PRIORITY.NORMAL,
        status: ORDER_STATUS.CREATED,
    };

    // 4. Create order in PostgreSQL
    const createdOrder = await orderRepository.createOrder(order);

    // 5. Publish OrderCreated event to Kafka
    await publishOrderCreated(createdOrder);

    // 6. Return created order
    return createdOrder;
}

async function getOrder(orderId) {
    const order = await orderRepository.findById(orderId);

    if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
    }

    return order;
}

async function getAllOrders() {
    return orderRepository.findAll();
}

async function updateOrderStatus(orderId, newStatus) {
    if (!Object.values(ORDER_STATUS).includes(newStatus)) {
        const error = new Error("Invalid order status");
        error.statusCode = 400;
        throw error;
    }

    const order = await getOrder(orderId);

    const allowedTransitions =
        VALID_STATUS_TRANSITIONS[order.status];

    if (!allowedTransitions.includes(newStatus)) {
        const error = new Error(
            `Invalid status transition: ${order.status} → ${newStatus}`
        );

        error.statusCode = 409;

        throw error;
    }

    return orderRepository.updateStatus(orderId, newStatus);
}

module.exports = {
    createOrder,
    getOrder,
    getAllOrders,
    updateOrderStatus,
};