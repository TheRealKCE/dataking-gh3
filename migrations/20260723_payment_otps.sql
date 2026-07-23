-- Migration: Payment Phone OTP (Hubtel Direct Receive Money — Option 2)
-- Date: 2026-07-23
--
-- Stores one-time codes used to confirm a payment phone number that is NOT the
-- user's registered profile number, before a Hubtel prompt is initiated.
-- Moved off Redis (Upstash quota) to Supabase so the flow is always available.

-- 1. Table: one active row per (user, msisdn); upsert replaces prior code.
CREATE TABLE IF NOT EXISTS public.payment_otps (
    user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    msisdn       VARCHAR(15) NOT NULL,           -- normalized 233XXXXXXXXX
    code         VARCHAR(6)  NOT NULL,
    attempts     INT NOT NULL DEFAULT 0,
    verified     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,   -- code validity
    verified_until TIMESTAMP WITH TIME ZONE,          -- verified-marker validity
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, msisdn)
);

-- 2. Helpful index for cleanup sweeps of expired rows.
CREATE INDEX IF NOT EXISTS idx_payment_otps_expires_at ON public.payment_otps(expires_at);

-- 3. RLS: this table is only ever accessed by the service-role key in API routes.
--    Deny all direct client access.
ALTER TABLE public.payment_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_otps_no_client_access" ON public.payment_otps;
CREATE POLICY "payment_otps_no_client_access"
    ON public.payment_otps
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Note: the service-role key bypasses RLS, so API routes still read/write freely.
