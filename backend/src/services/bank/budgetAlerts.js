// Budget spend alerts — fired by the bank sync pipeline when an imported
// (simulated) transaction pushes a category budget past a threshold.
//
//   sync pipeline → evaluateBudgetAlerts → budgets.last_alert_at_pct updated
//                                          → SSE "budget.alert" published
//
// Alerts fire ONCE per threshold crossing (configurable warn threshold,
// default 80%, plus the hard 100% "over" level). The last alerted level is
// persisted on the budget row (last_alert_at_pct), so a budget that is
// already past 80% doesn't toast on every new transaction — only when it
// crosses 100%, and never again after that.
//
// Spend is computed with the exact same query the budgets list uses
// (all-time expenses per category), so the alert always matches the
// percentage shown in the UI.
//
// If the budget is later raised (spend falls below the warn line again),
// last_alert_at_pct is reset so the cycle can alert anew.

const db = require("../../config/db");
const config = require("./bankConfig");
const realtime = require("./realtimeBus");

const OVER_PCT = 100;

/**
 * Pure decision helper — returns the alert level that should fire, or null.
 *
 * @param {number} spent - total expenses for the budget's category
 * @param {number} amount - budget limit
 * @param {number|null} lastAlertAtPct - highest threshold already alerted
 * @param {number} threshold - warn threshold (default from config)
 * @returns {'warn'|'over'|null}
 */
function nextAlertLevel(spent, amount, lastAlertAtPct, threshold = config.budgetAlertThreshold) {
  if (!(amount > 0)) return null;
  const pct = (spent / amount) * 100;
  const alerted = Number(lastAlertAtPct) || 0;

  if (pct >= OVER_PCT && alerted < OVER_PCT) return "over";
  if (pct >= threshold && alerted < threshold) return "warn";
  return null;
}

/**
 * Check every budget for a category after a new synced transaction and
 * publish a "budget.alert" SSE event for each threshold just crossed.
 *
 * @param {number} userId
 * @param {{ categoryId: number|null, transaction?: object }} ctx
 * @returns {Promise<Array<{budgetId: number, level: string, pct: number}>>}
 */
async function evaluateBudgetAlerts(userId, { categoryId, transaction }) {
  if (!categoryId) return [];

  const budgetsResult = await db.query(
    `SELECT b.*, c.name AS category_name,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS spent
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t ON t.user_id = b.user_id AND t.category_id = b.category_id
     WHERE b.user_id = $1 AND b.category_id = $2
     GROUP BY b.id, c.id`,
    [userId, categoryId],
  );

  const alerts = [];
  for (const budget of budgetsResult.rows) {
    const spent = Number(budget.spent);
    const amount = Number(budget.amount);
    let lastAlertAtPct = budget.last_alert_at_pct;

    // The budget was raised (or spend dropped back below the warn line) —
    // treat it as a fresh budget so future crossings alert again.
    if (
      lastAlertAtPct !== null &&
      amount > 0 &&
      (spent / amount) * 100 < config.budgetAlertThreshold
    ) {
      await db.query(
        "UPDATE budgets SET last_alert_at_pct = NULL WHERE id = $1 AND user_id = $2",
        [budget.id, userId],
      );
      lastAlertAtPct = null;
    }

    const level = nextAlertLevel(spent, amount, lastAlertAtPct);

    if (!level) continue;

    const alertPct = level === "over" ? OVER_PCT : config.budgetAlertThreshold;
    await db.query(
      "UPDATE budgets SET last_alert_at_pct = $1 WHERE id = $2 AND user_id = $3",
      [alertPct, budget.id, userId],
    );

    const pct = Math.round((spent / amount) * 1000) / 10;
    realtime.publish(userId, {
      type: "budget.alert",
      payload: {
        budgetId: budget.id,
        categoryId,
        categoryName: budget.category_name || null,
        level,
        spent,
        amount,
        pct,
        transaction: transaction
          ? {
              id: transaction.id,
              description: transaction.description || null,
              amount: Number(transaction.amount),
            }
          : null,
      },
    });

    alerts.push({ budgetId: budget.id, level, pct });
  }

  return alerts;
}

module.exports = { nextAlertLevel, evaluateBudgetAlerts, OVER_PCT };
