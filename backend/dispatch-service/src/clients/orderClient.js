const axios = require("axios");
const config = require("../config/config");

async function getOrder(orderId) {
    const response = await axios.get(
        `${config.orderServiceUrl}/orders/${orderId}`
    );

    return response.data.data;
}

async function updateOrderStatus(orderId, status, driverId = null) {
    const payload = { status };
    if (driverId) {
        payload.driverId = driverId;
    }

    const response = await axios.patch(
        `${config.orderServiceUrl}/orders/${orderId}/status`,
        payload
    );

    return response.data.data;
}

async function getAllOrders() {
    const response = await axios.get(
        `${config.orderServiceUrl}/orders`
    );

    return response.data.data;
}

module.exports = {
    getOrder,
    getAllOrders,
    updateOrderStatus,
};