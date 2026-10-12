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
        ORDER_STATUS.PICKUP,
        "PICKUP",
        "PICKED_UP",
        ORDER_STATUS.SEARCHING_DRIVER,
        ORDER_STATUS.CANCELLED,
    ],

    [ORDER_STATUS.PICKUP]: [
        ORDER_STATUS.IN_TRANSIT,
    ],

    "PICKED_UP": [
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

    // 3. Determine location_id and check for saved door instructions
    const locationId =
        data.locationId ||
        data.deliveryLocationId ||
        `loc_${Math.round(data.deliveryLatitude * 1000)}_${Math.round(data.deliveryLongitude * 1000)}`;

    let deliveryInstructions = data.deliveryInstructions || null;

    if (!deliveryInstructions && locationId) {
        try {
            const savedLoc = await orderRepository.getLocationInstructions(locationId);
            if (savedLoc && savedLoc.door_instructions) {
                deliveryInstructions = savedLoc.door_instructions;
            }
        } catch (err) {
            // Non-critical lookup
        }
    }

    // 4. Build order object
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

        locationId,
        deliveryInstructions,
    };

    // If instructions were provided during creation, cache in location_instructions for future orders
    if (deliveryInstructions && locationId) {
        try {
            await orderRepository.saveLocationInstructions({
                locationId,
                addressName: data.addressName || null,
                streetAddress: data.streetAddress || null,
                latitude: data.deliveryLatitude,
                longitude: data.deliveryLongitude,
                doorInstructions: deliveryInstructions,
                lastDriverId: null,
            });
        } catch (saveErr) {
            console.warn("[OrderService] Could not pre-cache location instructions:", saveErr.message);
        }
    }

    // 5. Create order in PostgreSQL
    const createdOrder = await orderRepository.createOrder(order);

    // 6. Publish OrderCreated event to Kafka
    await publishOrderCreated(createdOrder);

    // 7. Return created order
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
        VALID_STATUS_TRANSITIONS[order.status] || [];

    if (!allowedTransitions.includes(newStatus)) {
        const error = new Error(
            `Invalid status transition: ${order.status} → ${newStatus}`
        );

        error.statusCode = 409;

        throw error;
    }

    return orderRepository.updateStatus(orderId, newStatus);
}

async function getLocationInstructions(locationId) {
    if (!locationId) {
        const error = new Error("locationId is required");
        error.statusCode = 400;
        throw error;
    }

    return orderRepository.getLocationInstructions(locationId);
}

async function saveLocationInstructions(locationId, data) {
    if (!locationId) {
        const error = new Error("locationId is required");
        error.statusCode = 400;
        throw error;
    }

    if (!data.doorInstructions || !data.doorInstructions.trim()) {
        const error = new Error("doorInstructions is required");
        error.statusCode = 400;
        throw error;
    }

    return orderRepository.saveLocationInstructions({
        locationId,
        addressName: data.addressName,
        streetAddress: data.streetAddress,
        latitude: data.latitude,
        longitude: data.longitude,
        doorInstructions: data.doorInstructions.trim(),
        lastDriverId: data.driverId || data.lastDriverId,
    });
}

async function saveOrderInstructions(orderId, data) {
    const order = await getOrder(orderId);

    if (!data.doorInstructions || !data.doorInstructions.trim()) {
        const error = new Error("doorInstructions is required");
        error.statusCode = 400;
        throw error;
    }

    const instructions = data.doorInstructions.trim();
    const locationId = order.location_id || `loc_${Math.round(Number(order.delivery_latitude) * 1000)}_${Math.round(Number(order.delivery_longitude) * 1000)}`;

    // 1. Update orders table
    const updatedOrder = await orderRepository.updateDeliveryInstructions(orderId, instructions);

    // 2. Persist in location_instructions table so all future orders to this location reuse it
    await orderRepository.saveLocationInstructions({
        locationId,
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
        doorInstructions: instructions,
        lastDriverId: data.driverId || data.lastDriverId,
    });

    return updatedOrder;
}

module.exports = {
    createOrder,
    getOrder,
    getAllOrders,
    updateOrderStatus,
    getLocationInstructions,
    saveLocationInstructions,
    saveOrderInstructions,
};