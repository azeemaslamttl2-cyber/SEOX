-- Add a token column for administrator API access. Run this once on databases
-- that do not already contain users.admin_token.
ALTER TABLE users
  ADD COLUMN admin_token VARCHAR(255) NULL,
  ADD INDEX idx_users_admin_token (admin_token);
