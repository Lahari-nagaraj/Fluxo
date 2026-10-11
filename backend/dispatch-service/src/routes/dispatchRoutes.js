const express = require("express");
const controller = require("../controllers/dispatchController");

const router = express.Router();

router.post(
    "/orders/:orderId/dispatch",
    controller.dispatchOrder
);

router.get(
    "/assignments",
    controller.getActiveAssignments
);

router.get(
    "/assignments/:orderId",
    controller.getAssignment
);

router.post(
    "/reset-stuck-drivers",
    controller.resetStuckDrivers
);

module.exports = router;