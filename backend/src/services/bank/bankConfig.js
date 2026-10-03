// Centralized configuration for the Demo Bank simulation feature.
//
// All knobs are environment-driven (never frontend-controlled). The feature is
// a simulation only: it never touches real banks, credentials, or money.
//
//   DEMO_BANK_ENABLED               Master switch. Defaults to enabled in
//                                   development, disabled in production.
//   DEMO_BANK_SIMULATION_ENABLED    Background transaction generator. Defaults
//                                   to enabled in development, disabled in
//                                   production. Backend-enforced.
//   DEMO_BANK_TRANSACTION_INTERVAL  Seconds between simulated transactions
//                                   (default 180 = every 3 minutes).
//   DEMO_BANK_DEV_MODE              When true, the connect flow reveals the
//                                   simulated OTP in the API response so a
//                                   presenter can complete verification
//                                   without reading server logs.
//   DEMO_BANK_BUDGET_ALERT_THRESHOLD Percentage of a category budget that
//                                   triggers a "spend alert" toast when a
//                                   synced transaction pushes it past the
//                                   mark (default 80). 100% always alerts.

const DEFAULT_INTERVAL = 180;
const DEFAULT_BUDGET_ALERT_THRESHOLD = 80;

const isProduction = process.env.NODE_ENV === "production";

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function parseInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 30) return DEFAULT_INTERVAL;
  return Math.round(n);
}

function parseBudgetAlertThreshold(value) {
  const n = Number(value);
  // Sensible range: 50–99. 100% is always a hard "over budget" alert.
  if (!Number.isFinite(n) || n < 50 || n > 99) {
    return DEFAULT_BUDGET_ALERT_THRESHOLD;
  }
  return Math.round(n);
}

const config = {
  enabled: parseBool(process.env.DEMO_BANK_ENABLED, !isProduction),
  simulationEnabled: parseBool(
    process.env.DEMO_BANK_SIMULATION_ENABLED,
    !isProduction,
  ),
  transactionInterval: parseInterval(process.env.DEMO_BANK_TRANSACTION_INTERVAL),
  devMode: parseBool(process.env.DEMO_BANK_DEV_MODE, !isProduction),
  budgetAlertThreshold: parseBudgetAlertThreshold(
    process.env.DEMO_BANK_BUDGET_ALERT_THRESHOLD,
  ),
};

module.exports = config;
