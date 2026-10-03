-- Migration: monthly AI insights -> daily AI insights.
--
-- ai_insights only stores re-creatable generated summaries, so the old
-- monthly cache rows are cleared rather than converted. All user data
-- (users, categories, transactions, budgets) is left untouched.
DELETE FROM ai_insights;

ALTER TABLE ai_insights RENAME COLUMN period TO period_date;
ALTER TABLE ai_insights ALTER COLUMN period_date TYPE DATE USING period_date::date;
