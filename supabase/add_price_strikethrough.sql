-- Migration to support old prices and strikethrough display control
-- This enables admin to toggle price strikethrough and stores old prices (2 versions max)

-- Add columns to admin_settings for old prices and strikethrough toggle
INSERT INTO public.admin_settings (key, value) VALUES
  ('agent_upgrade_price_3d_old', '0'),
  ('agent_upgrade_price_14d_old', '0'),
  ('agent_upgrade_price_30d_old', '0'),
  ('show_price_strikethrough', 'false')
ON CONFLICT (key) DO NOTHING;
