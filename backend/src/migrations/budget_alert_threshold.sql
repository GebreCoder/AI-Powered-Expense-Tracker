-- Migration: Budget spend alerts.
--
-- Adds budgets.last_alert_at_pct so the bank sync pipeline can alert the user
-- once per threshold crossing (e.g. 80% warn, 100% over) instead of spamming
-- a toast for every transaction after a budget is crossed. NULL means no
-- threshold has been alerted yet.
--
-- Applied with:  node migrate.js budget_alert_threshold.sql
-- Reversible:    ALTER TABLE budgets DROP COLUMN IF EXISTS last_alert_at_pct;

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS last_alert_at_pct INT;
