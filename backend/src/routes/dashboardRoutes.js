const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/summary", dashboardController.getSummary);
router.get("/monthly-trend", dashboardController.getMonthlyTrend);
router.get("/category-breakdown", dashboardController.getCategoryBreakdown);

module.exports = router;
