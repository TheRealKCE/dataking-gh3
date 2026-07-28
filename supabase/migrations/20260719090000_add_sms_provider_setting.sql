-- Migration: Add default SMS provider setting
-- Inserts 'moolre' as the default active SMS provider.
-- Admins can switch to 'hubtel' via the Admin Settings UI.
-- Default is 'moolre' so existing behavior is unchanged until explicitly switched.

INSERT INTO public.admin_settings ("key", "value")
VALUES ('active_sms_provider', '"moolre"')
ON CONFLICT ("key") DO NOTHING;
