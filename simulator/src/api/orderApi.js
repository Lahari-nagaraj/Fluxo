const axios = require("axios");
const config = require("../config");

async function createOrder(order) {
    const response = await axios.post(
        `${config.orderServiceUrl}/orders`,
        order
    );

    return response.data.data;
}

async function dispatchOrder(orderId) {
    const response = await axios.post(
        `${config.dispatchServiceUrl}/dispatch/orders/${orderId}/dispatch`
    );

    return response.data.data;
}

module.exports = {
    createOrder,
    dispatchOrder,
};