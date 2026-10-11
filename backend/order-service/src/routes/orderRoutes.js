const express = require("express");

const {
    createOrder,
    getOrder,
    getAllOrders,
    updateOrderStatus,
    getLocationInstructions,
    saveLocationInstructions,
    saveOrderInstructions,
} = require("../controllers/orderController");

const router = express.Router();

router.post("/", createOrder);

router.get("/", getAllOrders);

router.get(
    "/locations/:locationId/instructions",
    getLocationInstructions
);

router.post(
    "/locations/:locationId/instructions",
    saveLocationInstructions
);

router.post("/:id/instructions", saveOrderInstructions);

router.get("/:id", getOrder);

router.patch("/:id/status", updateOrderStatus);

module.exports = router;