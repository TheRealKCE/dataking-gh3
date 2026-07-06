-- Add marketplace feature flag to admin_settings
-- Stages: 'false' (disabled) → 'admin' (admin-only QA) → 'true' (public launch)

BEGIN;

-- Marketplace feature flag
INSERT INTO admin_settings (key, value)
VALUES ('marketplace_enabled', '"false"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Marketplace page access control
INSERT INTO admin_settings (key, value)
VALUES ('page_access_marketplace', '"false"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;
