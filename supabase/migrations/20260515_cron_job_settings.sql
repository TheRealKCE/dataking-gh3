-- Add default cron job settings to admin_settings table

INSERT INTO public.admin_settings (key, value)
VALUES 
    ('cron_auto_refulfill_enabled', 'false'),
    ('cron_auto_refulfill_delay_minutes', '5'),
    ('cron_auto_complete_enabled', 'false'),
    ('cron_auto_complete_delay_minutes', '30')
ON CONFLICT (key) DO NOTHING;
