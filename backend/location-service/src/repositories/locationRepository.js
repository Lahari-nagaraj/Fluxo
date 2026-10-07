const pool = require("../config/database");

async function upsertLocation(location) {
    const query = `
        INSERT INTO driver_locations (
            driver_id,
            latitude,
            longitude,
            zone_id,
            updated_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)

        ON CONFLICT (driver_id)
        DO UPDATE SET
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            zone_id = EXCLUDED.zone_id,
            updated_at = CURRENT_TIMESTAMP

        RETURNING *;
    `;

    const values = [
        location.driverId,
        location.latitude,
        location.longitude,
        location.zoneId || null,
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
}

async function findByDriverId(driverId) {
    const query = `
        SELECT *
        FROM driver_locations
        WHERE driver_id = $1;
    `;

    const result = await pool.query(query, [driverId]);

    return result.rows[0];
}

async function findNearby(
    latitude,
    longitude,
    radiusKm
) {
    /*
     * Haversine distance calculation.
     *
     * This is intentionally simple for Step 4.
     * We will introduce spatial indexing/PostGIS
     * when we optimize geographic queries later.
     */

    const query = `
        SELECT
            driver_id,
            latitude,
            longitude,
            zone_id,
            updated_at,

            (
                6371 * acos(
                    LEAST(
                        1,
                        GREATEST(
                            -1,
                            cos(radians($1))
                            * cos(radians(latitude))
                            * cos(radians(longitude) - radians($2))
                            + sin(radians($1))
                            * sin(radians(latitude))
                        )
                    )
                )
            ) AS distance_km

        FROM driver_locations

        WHERE (
            6371 * acos(
                LEAST(
                    1,
                    GREATEST(
                        -1,
                        cos(radians($1))
                        * cos(radians(latitude))
                        * cos(radians(longitude) - radians($2))
                        + sin(radians($1))
                        * sin(radians(latitude))
                    )
                )
            )
        ) <= $3

        ORDER BY distance_km ASC;
    `;

    const result = await pool.query(query, [
        latitude,
        longitude,
        radiusKm,
    ]);

    return result.rows;
}

module.exports = {
    upsertLocation,
    findByDriverId,
    findNearby,
};