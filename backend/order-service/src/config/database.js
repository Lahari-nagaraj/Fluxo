
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    // Neon PostgreSQL requires an SSL connection
    ssl: process.env.DB_HOST
        ? { rejectUnauthorized: false }
        : undefined,
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL error:", error);
});

// Automatically ensure orders table valid_status constraint permits both PICKUP and PICKED_UP
// and ensure driver_id column exists
(async () => {
    try {
        await pool.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'valid_status'
                ) THEN
                    ALTER TABLE orders DROP CONSTRAINT valid_status;

                    ALTER TABLE orders ADD CONSTRAINT valid_status CHECK (
                        status IN (
                            'CREATED',
                            'SEARCHING_DRIVER',
                            'ASSIGNED',
                            'PICKUP',
                            'PICKED_UP',
                            'IN_TRANSIT',
                            'DELIVERED',
                            'CANCELLED'
                        )
                    );
                END IF;
            END $$;

            ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id VARCHAR(100);
        `);
    } catch (e) {
        // Non-critical startup migration check
        console.error("Status constraint migration skipped:", e.message);
    }
})();

module.exports = pool;
