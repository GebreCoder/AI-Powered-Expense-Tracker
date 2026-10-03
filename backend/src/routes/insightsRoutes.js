const express = require("express");
const insightsController = require("../controllers/insightsController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/", insightsController.getInsights);
router.post("/ask", insightsController.askInsights);

module.exports = router;
