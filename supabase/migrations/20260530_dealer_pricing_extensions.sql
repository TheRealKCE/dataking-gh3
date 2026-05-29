-- Add dealer_price to results_checker_types
ALTER TABLE results_checker_types ADD COLUMN IF NOT EXISTS dealer_price DECIMAL(10,2) DEFAULT 0;

-- Seed afa_price_dealer in admin_settings
INSERT INTO admin_settings (key, value)
VALUES ('afa_price_dealer', '15')
ON CONFLICT (key) DO NOTHING;

-- Seed dealer-specific shop_global_settings (mirrors existing customer/agent pattern)
INSERT INTO shop_global_settings (key, value)
VALUES
  ('shop_paystack_fee_percent_dealer', to_jsonb(1.50)),
  ('withdrawal_fee_percent_dealer',    to_jsonb(3.0)),
  ('withdrawal_fee_flat_dealer',       to_jsonb(0.0)),
  ('min_withdrawal_amount_dealer',     to_jsonb(30.0))
ON CONFLICT (key) DO NOTHING;
