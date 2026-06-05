-- Payment provider toggle settings
-- Allows switching between Moolre and Paystack at runtime without redeployment.
-- active_payment_provider_web  → controls wallet top-ups, agent upgrades, RC vouchers
-- active_payment_provider_shop → controls shop storefront orders

INSERT INTO admin_settings (key, value)
VALUES
  ('active_payment_provider_web',  '"moolre"'),
  ('active_payment_provider_shop', '"moolre"')
ON CONFLICT (key) DO NOTHING;
