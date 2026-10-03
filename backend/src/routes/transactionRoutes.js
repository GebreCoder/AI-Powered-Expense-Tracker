const express = require("express");
const transactionController = require("../controllers/transactionController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.post("/", transactionController.createTransaction);
router.get("/", transactionController.getTransactions);
router.put("/:id", transactionController.updateTransaction);
router.delete("/:id", transactionController.deleteTransaction);

module.exports = router;
