const pool = require("../config/database");

async function createOrder(order) {
    const query = `
        INSERT INTO orders (
            order_id,
            customer_id,
            pickup_latitude,
            pickup_longitude,
            delivery_latitude,
            delivery_longitude,
            priority,
            status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;

    const values = [
        order.orderId,
        order.customerId,
        order.pickupLatitude,
        order.pickupLongitude,
        order.deliveryLatitude,
        order.deliveryLongitude,
        order.priority,
        order.status,
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
}

async function findById(orderId) {
    const query = `
        SELECT *
        FROM orders
        WHERE order_id = $1;
    `;

    const result = await pool.query(query, [orderId]);

    return result.rows[0];
}

async function findAll() {
    const query = `
        SELECT *
        FROM orders
        ORDER BY created_at DESC;
    `;

    const result = await pool.query(query);

    return result.rows;
}

async function updateStatus(orderId, status) {
    const query = `
        UPDATE orders
        SET
            status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $2
        RETURNING *;
    `;

    const result = await pool.query(query, [status, orderId]);

    return result.rows[0];
}

module.exports = {
    createOrder,
    findById,
    findAll,
    updateStatus,
};