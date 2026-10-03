const express = require("express");
const rateLimit = require("express-rate-limit");
const bankController = require("../controllers/bankController");
const authMiddleware = require("../middleware/auth");
const bankConfig = require("../services/bank/bankConfig");

const router = express.Router();

// The whole demo-bank surface is gated server-side by DEMO_BANK_ENABLED.
// When disabled the routes are simply not available — no client can reach
// them, regardless of what the frontend shows.
if (!bankConfig.enabled) {
  router.all("*", (req, res) => {
    res.status(404).json({ error: "Route not found" });
  });
  module.exports = router;
} else {
  router.use(authMiddleware);

  // Brute-force guard for the OTP steps (mirrors the /api/auth limiter).
  const connectLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again in a few minutes." },
  });

  router.get("/config", bankController.getConfig);
  router.get("/providers", bankController.getProviders);
  router.get("/demo/accounts", bankController.getDemoAccounts);

  router.post("/connections", connectLimiter, bankController.createConnection);
  router.post("/connections/:id/verify", connectLimiter, bankController.verifyConnection);
  router.get("/connections", bankController.listConnections);
  router.delete("/connections/:id", bankController.disconnectConnection);

  router.get("/accounts", bankController.listAccounts);
  router.post("/accounts/:id/sync", bankController.syncAccount);
  router.post("/accounts/:id/simulate", bankController.simulateAccount);
  router.post("/accounts/:id/demo", bankController.demoSequence);

  router.get("/events", bankController.streamEvents);

  module.exports = router;
}
