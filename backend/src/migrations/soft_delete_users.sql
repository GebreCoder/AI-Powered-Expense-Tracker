-- Soft delete support for users table
-- Users are now deactivated instead of deleted, with a 30-day grace period

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for checking deactivated accounts during login
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
