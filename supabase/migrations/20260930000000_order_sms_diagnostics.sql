-- ============================================================
-- Why the last order confirmation did not send
--
-- Every reason a confirmation is skipped — no credits, no approved sender, a
-- gateway that cannot carry the shop's name — is invisible to the shop owner:
-- they switch the toggle on, buy something, and no SMS arrives. The reason
-- lives only in a server log they will never read.
--
-- Recording the last one lets the Order SMS screen say what happened, which is
-- the difference between "this is broken" and "top up your credits".
-- ============================================================

ALTER TABLE public.sms_accounts
  ADD COLUMN IF NOT EXISTS last_order_sms_skip    TEXT,
  ADD COLUMN IF NOT EXISTS last_order_sms_skip_at TIMESTAMPTZ;
