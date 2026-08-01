-- Migration: Trusted Payment Numbers (Hubtel "verify once" flow)
-- Date: 2026-08-01
--
-- Replaces the verify-every-time rule for Hubtel Direct Receive Money. A number is
-- verified by SMS code exactly ONCE; from then on it is trusted permanently and no
-- further code is ever requested — on the dashboard or the guest storefront, from
-- any device.
--
-- Trust attaches to the NUMBER, not to an account or a browser. That is deliberate:
-- it is what makes "just once" hold across surfaces. The containment for unsolicited
-- prompts is the per-number prompt rate limit in the API routes (rl:hubtel-prompt),
-- plus revoked_at as a manual kill switch.
--
-- Companion to migrations/20260723_payment_otps.sql, which stays as-is: payment_otps
-- is the transient 5-minute code scratch space, this table is the permanent record.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The trust table. One row per number — msisdn IS the primary key.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trusted_payment_numbers (
    msisdn        VARCHAR(15) PRIMARY KEY,          -- normalized 233XXXXXXXXX
    -- Who first verified it. Audit only — NEVER part of the trust lookup, and NULL
    -- for guest storefront verifications. ON DELETE SET NULL so removing a user
    -- does not silently revoke a number they no longer control anyway.
    verified_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ,
    payment_count INT NOT NULL DEFAULT 0,
    revoked_at    TIMESTAMPTZ,                      -- admin kill switch; NULL = trusted
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin list is ordered by recency; keep it cheap.
CREATE INDEX IF NOT EXISTS idx_tpn_verified_at
    ON public.trusted_payment_numbers(verified_at DESC);

-- 2. RLS: service-role only, matching payment_otps. Deny all direct client access.
ALTER TABLE public.trusted_payment_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trusted_payment_numbers_no_client_access" ON public.trusted_payment_numbers;
CREATE POLICY "trusted_payment_numbers_no_client_access"
    ON public.trusted_payment_numbers
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Guest codes.
--
--    payment_otps is keyed on (user_id, msisdn) and its user_id is a NOT NULL FK
--    to users — storefront customers have no account, so they cannot live there.
--    Rather than widen a live table (dropping its primary key and backfilling),
--    guests get their own table with the same semantics. payment_otps is left
--    completely untouched by this migration.
--
--    Keyed on msisdn alone: there is no account to scope a guest code to, and
--    only one code per number can be outstanding at a time anyway.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_payment_otps (
    msisdn         VARCHAR(15) PRIMARY KEY,        -- normalized 233XXXXXXXXX
    code           VARCHAR(6)  NOT NULL,
    attempts       INT NOT NULL DEFAULT 0,
    verified       BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at     TIMESTAMPTZ NOT NULL,           -- code validity (5 min)
    verified_until TIMESTAMPTZ,                    -- verified-marker validity (15 min)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for cleanup sweeps of expired rows.
CREATE INDEX IF NOT EXISTS idx_guest_payment_otps_expires_at
    ON public.guest_payment_otps(expires_at);

ALTER TABLE public.guest_payment_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_payment_otps_no_client_access" ON public.guest_payment_otps;
CREATE POLICY "guest_payment_otps_no_client_access"
    ON public.guest_payment_otps
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Note: the service-role key bypasses RLS, so API routes still read/write freely.
