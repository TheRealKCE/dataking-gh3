-- Seed 3-month dealer subscription price
INSERT INTO admin_settings (key, value)
VALUES ('dealer_subscription_price_3m', '169.99')
ON CONFLICT (key) DO NOTHING;
