const axios = require("axios");
const config = require("./config");

/**
 * Driver Delivery Simulator & Fleet Utilities
 */

/**
 * Fetch all active delivery assignments in progress from the Dispatch Service.
 */
async function getActiveAssignments() {
    try {
        const response = await axios.get(
            `${config.dispatchServiceUrl}/dispatch/assignments`
        );
        return response.data.data || [];
    } catch (error) {
        console.error("Failed to fetch active assignments:", error.message);
        return [];
    }
}

/**
 * Fetch assignment details for a specific order.
 */
async function getOrderAssignment(orderId) {
    try {
        const response = await axios.get(
            `${config.dispatchServiceUrl}/dispatch/assignments/${orderId}`
        );
        return response.data.data || null;
    } catch (error) {
        console.error(`Failed to fetch assignment for order ${orderId}:`, error.message);
        return null;
    }
}

/**
 * Resets all stuck BUSY drivers in Driver Service & Redis back to AVAILABLE.
 */
async function resetStuckDrivers() {
    try {
        const response = await axios.post(
            `${config.dispatchServiceUrl}/dispatch/reset-stuck-drivers`
        );
        return response.data.data;
    } catch (error) {
        console.error("Failed to reset stuck drivers:", error.message);
        throw error;
    }
}

module.exports = {
    getActiveAssignments,
    getOrderAssignment,
    resetStuckDrivers,
};
