ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
