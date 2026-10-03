const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const path = require("path");

// Load .env from the backend folder regardless of the current working directory.
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const insightsRoutes = require("./routes/insightsRoutes");
const bankRoutes = require("./routes/bankRoutes");

const app = express();

// CORS: only allow the frontend origin (override with FRONTEND_URL env var).
const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: frontendOrigin }));

app.use(morgan("dev"));
// 10 MB limit: profile avatar images arrive as base64 data URLs
// (a 5 MB image is ~6.7 MB encoded).
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — protects login/register from brute force and insights
// from burning the AI API budget.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

const insightsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Insights rate limit reached. Please try again in an hour." },
});

const DEFAULT_AI_MODEL = "gemini-3.5-flash";

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Expense Tracker API is running",
    aiEnabled: Boolean(process.env.GEMINI_API_KEY),
    aiModel: process.env.AI_MODEL || DEFAULT_AI_MODEL,
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/insights", insightsLimiter, insightsRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bank", bankRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

module.exports = app;
