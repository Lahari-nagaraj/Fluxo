const dispatchService = require("../services/dispatchService");

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

module.exports = {
    dispatchOrder,
};