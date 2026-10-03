const express = require("express");
const categoryController = require("../controllers/categoryController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.post("/", categoryController.createCategory);
router.get("/", categoryController.getCategories);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

module.exports = router;
