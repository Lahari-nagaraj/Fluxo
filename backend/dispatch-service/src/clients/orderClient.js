const axios = require("axios");
const config = require("../config/config");

async function getOrder(orderId) {
    const response = await axios.get(
        `${config.orderServiceUrl}/orders/${orderId}`
    );

    return response.data.data;
}

async function updateOrderStatus(orderId, status) {
    const response = await axios.patch(
        `${config.orderServiceUrl}/orders/${orderId}/status`,
        {
            status,
        }
    );

    return response.data.data;
}

module.exports = {
    getOrder,
    updateOrderStatus,
};