const express = require("express");

const {
    createOrder,
    getOrder,
    getAllOrders,
    updateOrderStatus,
} = require("../controllers/orderController");

const router = express.Router();

router.post("/", createOrder);

router.get("/", getAllOrders);

router.get("/:id", getOrder);

router.patch("/:id/status", updateOrderStatus);

module.exports = router;