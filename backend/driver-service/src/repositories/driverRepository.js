const pool = require("../config/database");

async function createDriver(driver) {
    const query = `
        INSERT INTO drivers (
            driver_id,
            name,
            phone,
            vehicle_type,
            capacity,
            status,
            zone_id,
            last_heartbeat
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;

    const values = [
        driver.driverId,
        driver.name,
        driver.phone,
        driver.vehicleType,
        driver.capacity,
        driver.status,
        driver.zoneId,
        driver.lastHeartbeat,
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
}

async function findById(driverId) {
    const query = `
        SELECT *
        FROM drivers
        WHERE driver_id = $1;
    `;

    const result = await pool.query(query, [driverId]);

    return result.rows[0];
}

async function findAll() {
    const query = `
        SELECT *
        FROM drivers
        ORDER BY created_at DESC;
    `;

    const result = await pool.query(query);

    return result.rows;
}

async function findAvailable() {
    const query = `
        SELECT *
        FROM drivers
        WHERE status = 'AVAILABLE'
        ORDER BY created_at ASC;
    `;

    const result = await pool.query(query);

    return result.rows;
}

async function updateStatus(driverId, status) {
    const query = `
        UPDATE drivers
        SET
            status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE driver_id = $2
        RETURNING *;
    `;

    const result = await pool.query(query, [status, driverId]);

    return result.rows[0];
}

async function updateHeartbeat(driverId) {
    const query = `
        UPDATE drivers
        SET
            last_heartbeat = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE driver_id = $1
        RETURNING *;
    `;

    const result = await pool.query(query, [driverId]);

    return result.rows[0];
}

module.exports = {
    createDriver,
    findById,
    findAll,
    findAvailable,
    updateStatus,
    updateHeartbeat,
};