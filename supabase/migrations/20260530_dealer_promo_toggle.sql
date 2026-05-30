-- Seed dealer_promo_enabled toggle (default OFF)
INSERT INTO admin_settings (key, value)
VALUES ('dealer_promo_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
