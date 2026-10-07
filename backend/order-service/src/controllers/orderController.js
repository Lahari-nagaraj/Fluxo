const orderService = require("../services/orderService");

async function createOrder(req, res, next) {
    try {
        const order = await orderService.createOrder(req.body);

        res.status(201).json({
            success: true,
            data: order,
        });
    } catch (error) {
        next(error);
    }
}

async function getOrder(req, res, next) {
    try {
        const order = await orderService.getOrder(req.params.id);

        res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error) {
        next(error);
    }
}

async function getAllOrders(req, res, next) {
    try {
        const orders = await orderService.getAllOrders();

        res.status(200).json({
            success: true,
            data: orders,
        });
    } catch (error) {
        next(error);
    }
}

async function updateOrderStatus(req, res, next) {
    try {
        const order = await orderService.updateOrderStatus(
            req.params.id,
            req.body.status
        );

        res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createOrder,
    getOrder,
    getAllOrders,
    updateOrderStatus,
};