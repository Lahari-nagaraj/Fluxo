const axios = require("axios");
const config = require("../config");

async function createDriver(driver) {
    const response = await axios.post(
        `${config.driverServiceUrl}/drivers`,
        driver
    );

    return response.data.data;
}

async function updateDriverStatus(
    driverId,
    status
) {
    const response = await axios.patch(
        `${config.driverServiceUrl}/drivers/${driverId}/status`,
        {
            status,
        }
    );

    return response.data.data;
}

module.exports = {
    createDriver,
    updateDriverStatus,
};