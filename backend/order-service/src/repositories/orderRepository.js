const pool = require("../config/database");

async function createOrder(order) {
    const query = `
        INSERT INTO orders (
            order_id,
            customer_id,
            pickup_latitude,
            pickup_longitude,
            pickup_zone_id,
            delivery_latitude,
            delivery_longitude,
            priority,
            status,
            location_id,
            delivery_instructions
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
    `;

    const values = [
        order.orderId,
        order.customerId,
        order.pickupLatitude,
        order.pickupLongitude,
        order.pickupZoneId,
        order.deliveryLatitude,
        order.deliveryLongitude,
        order.priority,
        order.status,
        order.locationId || null,
        order.deliveryInstructions || null,
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

async function updateDeliveryInstructions(orderId, instructions) {
    const query = `
        UPDATE orders
        SET
            delivery_instructions = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $2
        RETURNING *;
    `;

    const result = await pool.query(query, [instructions, orderId]);

    return result.rows[0];
}

async function getLocationInstructions(locationId) {
    const query = `
        SELECT *
        FROM location_instructions
        WHERE location_id = $1;
    `;

    const result = await pool.query(query, [locationId]);

    return result.rows[0] || null;
}

async function saveLocationInstructions(data) {
    const query = `
        INSERT INTO location_instructions (
            location_id,
            address_name,
            street_address,
            latitude,
            longitude,
            door_instructions,
            last_driver_id,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (location_id) DO UPDATE SET
            door_instructions = EXCLUDED.door_instructions,
            address_name = COALESCE(EXCLUDED.address_name, location_instructions.address_name),
            street_address = COALESCE(EXCLUDED.street_address, location_instructions.street_address),
            latitude = COALESCE(EXCLUDED.latitude, location_instructions.latitude),
            longitude = COALESCE(EXCLUDED.longitude, location_instructions.longitude),
            last_driver_id = COALESCE(EXCLUDED.last_driver_id, location_instructions.last_driver_id),
            updated_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;

    const values = [
        data.locationId,
        data.addressName || null,
        data.streetAddress || null,
        data.latitude || null,
        data.longitude || null,
        data.doorInstructions,
        data.lastDriverId || null,
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
}

module.exports = {
    createOrder,
    findById,
    findAll,
    updateStatus,
    updateDeliveryInstructions,
    getLocationInstructions,
    saveLocationInstructions,
};