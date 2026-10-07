const express = require("express");
const controller = require("../controllers/dispatchController");

const router = express.Router();

router.post(
    "/orders/:orderId/dispatch",
    controller.dispatchOrder
);

module.exports = router;