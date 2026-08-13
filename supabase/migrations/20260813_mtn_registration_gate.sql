-- Migration: MTN Registration Gate at purchase time
-- Date: 2026-08-13
--
-- Today an MTN order to a number that is not enabled ("whitelisted") on the Agent
-- Portal account is accepted silently: wallet debited, order created, and only then
-- does fulfillOrder() hit the whitelist gate and leave the order pending with no
-- explanation. This migration backs the fix — checking BEFORE payment, and holding
-- the order explicitly once the buyer has agreed to the wait.
--
-- Two pieces:
--   1. mtn_registered_numbers — a local cache so we do not pay an upstream
--      round-trip on every purchase. Positive results are permanent (a number
--      does not become un-registered); negative results are re-checked on a short
--      TTL by the caller.
--   2. awaiting_registration flags on orders / shop_orders, so these held orders
--      are distinguishable from ordinary stuck pending orders in the admin queue.
--
-- The master switch itself lives in admin_settings (key mtn_registration_gate_enabled)
-- and needs no schema change — that table is already key/value.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Registration cache. One row per number — the normalized msisdn IS the key.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mtn_registered_numbers (
    phone_number       VARCHAR(15) PRIMARY KEY,          -- normalized 0XXXXXXXXX
    is_registered      BOOLEAN NOT NULL DEFAULT FALSE,
    -- When we first submitted it to MTN. Set on the first check that came back
    -- not-registered, never overwritten — it is what "how long has this been
    -- waiting?" is measured from.
    first_submitted_at TIMESTAMPTZ,
    registered_at      TIMESTAMPTZ,                      -- when it flipped to enabled
    last_checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Negative rows are re-checked on a TTL; this keeps that scan cheap.
CREATE INDEX IF NOT EXISTS idx_mrn_unregistered_checked
    ON public.mtn_registered_numbers(last_checked_at)
    WHERE is_registered = FALSE;

-- RLS: service-role only. Deny all direct client access, matching
-- migrations/20260801_trusted_payment_numbers.sql.
ALTER TABLE public.mtn_registered_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mtn_registered_numbers_no_client_access" ON public.mtn_registered_numbers;
CREATE POLICY "mtn_registered_numbers_no_client_access"
    ON public.mtn_registered_numbers
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Held-order flags.
--
--    awaiting_registration = TRUE means: the buyer was told the number is not
--    registered, agreed to the wait, and paid anyway. The order stays pending and
--    the existing agentportal-mtn-verify cron delivers it once MTN enables the
--    number — no separate queue, no manual step.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS awaiting_registration BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS registration_submitted_at TIMESTAMPTZ;

ALTER TABLE public.shop_orders
    ADD COLUMN IF NOT EXISTS awaiting_registration BOOLEAN NOT NULL DEFAULT FALSE;

-- Admin queue filters on exactly this; partial so it stays tiny.
CREATE INDEX IF NOT EXISTS idx_orders_pending_awaiting_reg
    ON public.orders(created_at DESC)
    WHERE status = 'pending' AND awaiting_registration = TRUE;
