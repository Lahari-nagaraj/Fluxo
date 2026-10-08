const ZONE_SIZE = 0.05;

function getZoneId(latitude, longitude) {
    const latIndex = Math.floor((latitude + 90) / ZONE_SIZE);
    const lonIndex = Math.floor((longitude + 180) / ZONE_SIZE);

    return `ZONE_${latIndex}_${lonIndex}`;
}

module.exports = {
    getZoneId,
};