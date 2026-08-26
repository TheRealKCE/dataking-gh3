-- ============================================================
-- Hand the USSD switch back to /admin/settings, from a known state
--
-- lib/ussd-availability.ts had USSD_HARD_DISABLED = true, which ignored this
-- table entirely. That block is now lifted, so admin_settings.ussd_enabled
-- decides again.
--
-- Which is exactly why this file force-writes the value instead of leaving it.
-- The hard block was added because the stored value could not be trusted: the
-- toggle in /admin/settings only writes on Save, so USSD kept taking money while
-- everyone believed it was shut and the row still said 'true'. Lifting the block
-- without pinning the row would hand the service straight back to that same
-- unverified string — and reopen USSD the moment this deploys.
--
-- So: DO UPDATE, not DO NOTHING. After this migration the answer is 'false' no
-- matter what was there before, and reopening USSD is one deliberate flip in the
-- admin UI by someone who meant it.
--
-- Short codes shops have already bought are untouched. This is about whether the
-- service answers, not about what anyone owns.
-- ============================================================

INSERT INTO public.admin_settings (key, value)
VALUES ('ussd_enabled', 'false')
ON CONFLICT (key) DO UPDATE
    SET value = 'false',
        updated_at = NOW();
