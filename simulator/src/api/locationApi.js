const axios = require("axios");
const config = require("../config");

async function updateLocation(location) {
    const response = await axios.post(
        `${config.locationServiceUrl}/locations`,
        location
    );

    return response.data.data;
}

module.exports = {
    updateLocation,
};