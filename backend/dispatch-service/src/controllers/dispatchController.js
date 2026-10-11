const dispatchService = require("../services/dispatchService");
const deliveryLifecycleService = require("../services/deliveryLifecycleService");

async function dispatchOrder(req, res, next) {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            const error = new Error(
                "orderId is required"
            );

            error.statusCode = 400;
            throw error;
        }

        const result =
            await dispatchService.dispatchOrder(orderId);

        res.status(200).json({
            success: true,
            message: "Order dispatched successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

async function getAssignment(req, res, next) {
    try {
        const { orderId } = req.params;
        const assignment = await deliveryLifecycleService.getAssignment(orderId);

        res.status(200).json({
            success: true,
            data: assignment,
        });
    } catch (error) {
        next(error);
    }
}

async function getActiveAssignments(req, res, next) {
    try {
        const assignments = await deliveryLifecycleService.getActiveAssignments();

        res.status(200).json({
            success: true,
            data: assignments,
        });
    } catch (error) {
        next(error);
    }
}

async function resetStuckDrivers(req, res, next) {
    try {
        const result = await deliveryLifecycleService.resetStuckDrivers();

        res.status(200).json({
            success: true,
            message: `Reset ${result.resetCount} stuck drivers back to AVAILABLE`,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    dispatchOrder,
    getAssignment,
    getActiveAssignments,
    resetStuckDrivers,
};