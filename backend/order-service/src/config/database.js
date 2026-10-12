const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL error:", error);
});

// Automatically ensure orders table valid_status constraint permits both PICKUP and PICKED_UP
(async () => {
    try {
        await pool.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'valid_status'
                ) THEN
                    ALTER TABLE orders DROP CONSTRAINT valid_status;
                    ALTER TABLE orders ADD CONSTRAINT valid_status CHECK (
                        status IN ('CREATED', 'SEARCHING_DRIVER', 'ASSIGNED', 'PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
                    );
                END IF;
            END $$;
        `);
    } catch (e) {
        // Non-critical startup migration check
    }
})();

module.exports = pool;