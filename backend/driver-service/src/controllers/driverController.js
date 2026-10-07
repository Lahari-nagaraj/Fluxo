const driverService = require("../services/driverService");

async function createDriver(req, res, next) {
    try {
        const driver = await driverService.createDriver(req.body);

        res.status(201).json({
            success: true,
            data: driver,
        });
    } catch (error) {
        next(error);
    }
}

async function getDriver(req, res, next) {
    try {
        const driver = await driverService.getDriver(
            req.params.id
        );

        res.status(200).json({
            success: true,
            data: driver,
        });
    } catch (error) {
        next(error);
    }
}

async function getAllDrivers(req, res, next) {
    try {
        const drivers = await driverService.getAllDrivers();

        res.status(200).json({
            success: true,
            data: drivers,
        });
    } catch (error) {
        next(error);
    }
}

async function getAvailableDrivers(req, res, next) {
    try {
        const drivers =
            await driverService.getAvailableDrivers();

        res.status(200).json({
            success: true,
            data: drivers,
        });
    } catch (error) {
        next(error);
    }
}

async function updateDriverStatus(req, res, next) {
    try {
        const driver =
            await driverService.updateDriverStatus(
                req.params.id,
                req.body.status
            );

        res.status(200).json({
            success: true,
            data: driver,
        });
    } catch (error) {
        next(error);
    }
}

async function updateHeartbeat(req, res, next) {
    try {
        const driver =
            await driverService.updateHeartbeat(
                req.params.id
            );

        res.status(200).json({
            success: true,
            data: driver,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createDriver,
    getDriver,
    getAllDrivers,
    getAvailableDrivers,
    updateDriverStatus,
    updateHeartbeat,
};