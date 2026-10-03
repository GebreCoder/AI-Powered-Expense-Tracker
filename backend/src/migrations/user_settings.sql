-- User account settings (profile edit, currency, avatar, session revocation)
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'ETB';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image TEXT;
