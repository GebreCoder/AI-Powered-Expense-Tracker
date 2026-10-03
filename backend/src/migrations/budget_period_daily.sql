-- Migration: allow daily budgets.
--
-- Extends the budgets.period CHECK constraint so existing databases can
-- store 'daily' budgets alongside weekly/monthly/yearly. Applied with:
--   node migrate.js budget_period_daily.sql
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_period_check;
ALTER TABLE budgets ADD CONSTRAINT budgets_period_check
  CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly'));
