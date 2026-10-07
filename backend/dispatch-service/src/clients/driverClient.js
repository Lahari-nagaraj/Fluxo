const axios = require("axios");
const config = require("../config/config");

async function getAvailableDrivers() {
    const response = await axios.get(
        `${config.driverServiceUrl}/drivers/available`
    );

    return response.data.data;
}

async function updateDriverStatus(driverId, status) {
    const response = await axios.patch(
        `${config.driverServiceUrl}/drivers/${driverId}/status`,
        {
            status,
        }
    );

    return response.data.data;
}

module.exports = {
    getAvailableDrivers,
    updateDriverStatus,
};