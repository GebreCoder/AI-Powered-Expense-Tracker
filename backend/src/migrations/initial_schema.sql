DROP TABLE IF EXISTS ai_insights;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS bank_accounts;
DROP TABLE IF EXISTS bank_connections;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demo bank connections (simulation only). See src/services/bank for the
-- provider abstraction and simulator.
CREATE TABLE bank_connections (
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

CREATE TABLE bank_accounts (
  id SERIAL PRIMARY KEY,
  bank_connection_id INT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  external_account_id VARCHAR(120) NOT NULL,
  account_number_masked VARCHAR(20) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  account_name VARCHAR(120) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'ETB',
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  transaction_date DATE NOT NULL,
  -- Bank sync traceability: 'manual' entries are user-typed, 'bank' entries
  -- were imported from a connected (simulated) bank account.
  source VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'bank')),
  external_transaction_id VARCHAR(120),
  bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Dedup key: one imported transaction per provider id per user.
  CONSTRAINT transactions_user_external_unique UNIQUE (user_id, external_transaction_id)
);

CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  period VARCHAR(20) DEFAULT 'monthly' CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  -- Highest spend-alert threshold already fired (e.g. 80 = warn, 100 = over).
  -- NULL = never alerted. Set by the bank sync pipeline (see bankBudgetAlerts).
  last_alert_at_pct INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_insights (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  source VARCHAR(10) NOT NULL DEFAULT 'ai',
  insights JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, period_date)
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_source ON transactions(source);
CREATE INDEX idx_transactions_bank_account ON transactions(bank_account_id);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_bank_connections_user ON bank_connections(user_id);
CREATE INDEX idx_bank_connections_status ON bank_connections(status);
CREATE INDEX idx_bank_accounts_connection ON bank_accounts(bank_connection_id);
