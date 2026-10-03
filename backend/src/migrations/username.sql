-- Username sign-in: give every account a unique, lowercase username.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Backfill existing users from their email local-part: lowercased, truncated,
-- characters outside the allowed set (a-z 0-9 _ . -) replaced with "_", and a
-- numeric suffix appended when two users share the same base.
UPDATE users u
SET username = sub.username
FROM (
  SELECT id,
         base || CASE WHEN rn = 1 THEN '' ELSE '_' || (rn - 1) END AS username
  FROM (
    SELECT id,
           REGEXP_REPLACE(
             LOWER(LEFT(SPLIT_PART(email, '@', 1), 20)),
             '[^a-z0-9_.-]',
             '_',
             'g'
           ) AS base,
           ROW_NUMBER() OVER (
             PARTITION BY REGEXP_REPLACE(
               LOWER(LEFT(SPLIT_PART(email, '@', 1), 20)),
               '[^a-z0-9_.-]',
               '_',
               'g'
             )
             ORDER BY id
           ) AS rn
    FROM users
  ) t
) sub
WHERE u.id = sub.id AND u.username IS NULL;

-- Safety net: any remaining NULL (e.g. empty email local-parts) gets a
-- unique placeholder so the NOT NULL constraint below cannot fail.
UPDATE users u
SET username = 'user_' || u.id
WHERE u.username IS NULL;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
