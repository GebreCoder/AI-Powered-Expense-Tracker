-- Migration: Default display currency to Ethiopian Birr (ETB).
--
-- The Demo Bank feature is themed for Ethiopian institutions (Anbessa Bank,
-- CBE, Dashen Bank), so new accounts and linked bank accounts default to ETB.
-- Users can still switch their display currency in Settings → Preferences.
-- Existing rows keep their current value.
--
-- Applied with:  node migrate.js currency_etb.sql
-- Reversible:    ALTER TABLE users ALTER COLUMN currency SET DEFAULT 'USD';
--                ALTER TABLE bank_accounts ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE users ALTER COLUMN currency SET DEFAULT 'ETB';
ALTER TABLE bank_accounts ALTER COLUMN currency SET DEFAULT 'ETB';
