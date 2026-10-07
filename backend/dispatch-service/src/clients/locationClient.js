const axios = require("axios");
const config = require("../config/config");

async function getDriverLocation(driverId) {
    const response = await axios.get(
        `${config.locationServiceUrl}/locations/${driverId}`
    );

    return response.data.data;
}

module.exports = {
    getDriverLocation,
};