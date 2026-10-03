const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/profile", authMiddleware, authController.getProfile);
router.put("/profile", authMiddleware, authController.updateProfile);
router.put("/password", authMiddleware, authController.changePassword);
router.post("/revoke-sessions", authMiddleware, authController.revokeSessions);
router.delete("/account", authMiddleware, authController.deleteAccount);

module.exports = router;
