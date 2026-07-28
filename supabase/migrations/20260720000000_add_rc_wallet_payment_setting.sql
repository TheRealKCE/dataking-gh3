-- Results Checker wallet payment toggle
-- When 'false', the wallet payment option is hidden on the RC checkout page
-- and users must pay directly via the configured payment gateway (Hubtel / Moolre / Paystack).

INSERT INTO admin_settings (key, value)
VALUES ('rc_wallet_payment_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
