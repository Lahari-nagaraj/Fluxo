const locationService = require("../services/locationService");

async function updateLocation(req, res, next) {
    try {
        const location =
            await locationService.updateLocation(
                req.body
            );

        /*
         * Broadcast is attached later through
         * the websocket layer.
         */
        req.app.locals.broadcastLocation(location);

        res.status(200).json({
            success: true,
            data: location,
        });
    } catch (error) {
        next(error);
    }
}

async function getDriverLocation(req, res, next) {
    try {
        const location =
            await locationService.getDriverLocation(
                req.params.driverId
            );

        res.status(200).json({
            success: true,
            data: location,
        });
    } catch (error) {
        next(error);
    }
}

async function getNearbyDrivers(req, res, next) {
    try {
        const latitude = Number(
            req.query.latitude
        );

        const longitude = Number(
            req.query.longitude
        );

        const radiusKm = Number(
            req.query.radiusKm || 5
        );

        const drivers =
            await locationService.getNearbyDrivers(
                latitude,
                longitude,
                radiusKm
            );

        res.status(200).json({
            success: true,
            data: drivers,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    updateLocation,
    getDriverLocation,
    getNearbyDrivers,
};