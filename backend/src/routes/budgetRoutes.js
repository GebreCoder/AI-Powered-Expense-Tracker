const express = require("express");
const budgetController = require("../controllers/budgetController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.post("/", budgetController.createBudget);
router.get("/", budgetController.getBudgets);
router.put("/:id", budgetController.updateBudget);
router.delete("/:id", budgetController.deleteBudget);

module.exports = router;
