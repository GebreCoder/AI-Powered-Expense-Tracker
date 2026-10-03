-- Migration: Demo Bank Connections (bank_connections, bank_accounts) and
-- traceability fields on the existing transactions table.
--
-- Applied with:  node migrate.js bank_schema.sql
-- Reversible:    drop the two new tables and the three new columns (see bottom).
--
-- Design notes
-- ------------
-- * Imported bank transactions live in the SAME transactions table as manual
--   entries (no duplicate transaction system). They are tagged with:
--     source                 = 'bank'
--     external_transaction_id = the provider's id (dedup key)
--     bank_account_id         = the linked bank_accounts row
-- * Deduplication is enforced at the database level: one row per
--   (user_id, external_transaction_id). NULL external ids (manual entries)
--   never collide because PostgreSQL treats NULLs as distinct.
-- * Disconnecting a bank connection removes EVERYTHING related to that
--   bank: the controller deletes the imported transactions first (while
--   their bank_account_id link still exists), then deletes the connection
--   and bank_accounts cascade with it. The FK from transactions to
--   bank_accounts is ON DELETE SET NULL as a safety net for any other path.

-- ---------------------------------------------------------------------------
-- 1. bank_connections — one row per linked bank (provider) per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_connections (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL,
  institution_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_otp'
    CHECK (status IN ('pending_otp', 'connected', 'disconnected')),
  external_connection_id VARCHAR(120),
  external_account_id VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_status ON bank_connections(status);

-- ---------------------------------------------------------------------------
-- 2. bank_accounts — linked accounts with the simulated bank's balances
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  bank_connection_id INT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  external_account_id VARCHAR(120) NOT NULL,
  account_number_masked VARCHAR(20) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  account_name VARCHAR(120) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_connection ON bank_accounts(bank_connection_id);

-- ---------------------------------------------------------------------------
-- 3. Extend the existing transactions table
-- ---------------------------------------------------------------------------
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'manual';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_transaction_id VARCHAR(120);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- One imported transaction per provider id per user.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_external_unique;
ALTER TABLE transactions ADD CONSTRAINT transactions_user_external_unique
  UNIQUE (user_id, external_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON transactions(bank_account_id);

-- ===========================================================================
-- Rollback (run manually if you ever need to undo this migration):
--   ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_external_unique;
--   DROP INDEX IF EXISTS idx_transactions_source;
--   DROP INDEX IF EXISTS idx_transactions_bank_account;
--   ALTER TABLE transactions DROP COLUMN IF EXISTS bank_account_id;
--   ALTER TABLE transactions DROP COLUMN IF EXISTS external_transaction_id;
--   ALTER TABLE transactions DROP COLUMN IF EXISTS source;
--   DROP TABLE IF EXISTS bank_accounts;
--   DROP TABLE IF EXISTS bank_connections;
-- ===========================================================================
