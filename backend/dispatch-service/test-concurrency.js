const axios = require("axios");

const DISPATCH_URL =
    "http://localhost:3004/dispatch/orders";

const order1 =
    "YOUR_ORDER_ID_1";

const order2 =
    "YOUR_ORDER_ID_2";

async function dispatch(orderId) {
    try {
        const response = await axios.post(
            `${DISPATCH_URL}/${orderId}/dispatch`
        );

        console.log(
            `Order ${orderId}:`,
            response.data
        );
    } catch (error) {
        console.log(
            `Order ${orderId}:`,
            error.response?.data || error.message
        );
    }
}

async function main() {
    await Promise.all([
        dispatch(order1),
        dispatch(order2),
    ]);
}

main();