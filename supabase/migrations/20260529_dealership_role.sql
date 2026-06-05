-- Add 'dealer' to role check constraint on users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'agent', 'admin', 'sub-admin', 'dealer'));

-- Add dealer tracking columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS dealer_claimed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dealer_expires_at TIMESTAMPTZ;

-- Add dealer_price column to data_packages
ALTER TABLE data_packages ADD COLUMN IF NOT EXISTS dealer_price DECIMAL(10,2);

-- Seed admin_settings keys for dealer subscription pricing and auto-upgrade toggle
INSERT INTO admin_settings (key, value)
VALUES
  ('dealer_subscription_price_6m', '299.99'),
  ('auto_upgrade_expired_dealers', 'false')
ON CONFLICT (key) DO NOTHING;
