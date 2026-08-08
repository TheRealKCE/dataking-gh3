-- Migration: Hubtel auto-fulfilment for airtime orders.
--
-- Until now every airtime order was delivered by hand: an admin read the order off
-- /admin/airtime and topped the number up personally. Hubtel Commission Services can
-- do it over the API, but it caps a single request at GHS 100 — so an order larger
-- than that is delivered as several "legs", and the order is only complete once every
-- leg is. airtime_fulfillment_legs is that per-leg record.
--
-- The UNIQUE (order_id, leg_index) is the idempotency key. The dispatcher inserts the
-- leg row BEFORE calling Hubtel, so a duplicate invocation (retry, double webhook,
-- cron overlap) collides on insert instead of sending the airtime twice. Value that
-- has left the account cannot be pulled back, so this constraint is load-bearing.

-- ─── airtime_orders: who fulfilled it and with what ──────────────────────────
ALTER TABLE public.airtime_orders
    ADD COLUMN IF NOT EXISTS provider TEXT,                     -- 'hubtel' when auto-fulfilled
    ADD COLUMN IF NOT EXISTS provider_reference TEXT,           -- first leg's ClientReference
    ADD COLUMN IF NOT EXISTS provider_response JSONB,
    ADD COLUMN IF NOT EXISTS auto_fulfillment_attempted_at TIMESTAMPTZ;

-- ─── One row per Hubtel top-up request ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.airtime_fulfillment_legs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID NOT NULL REFERENCES public.airtime_orders(id) ON DELETE CASCADE,
    -- 1-based position within the split, so notes can say "leg 2 of 3".
    leg_index         INT NOT NULL,
    client_reference  TEXT NOT NULL UNIQUE,
    amount            NUMERIC(12,2) NOT NULL,
    -- submitting = row claimed, Hubtel not yet answered. A leg stuck here means the
    -- process died mid-call and the top-up state is genuinely unknown — the
    -- reconciliation cron flags these for a human rather than guessing.
    status            TEXT NOT NULL DEFAULT 'submitting'
                        CHECK (status IN ('submitting', 'pending', 'success', 'failed')),
    transaction_id    TEXT,
    commission        NUMERIC(12,4),
    response_code     TEXT,           -- '0001' accepted | '0000' immediate success | other
    message           TEXT,
    raw               JSONB,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT airtime_fulfillment_legs_order_leg_unique UNIQUE (order_id, leg_index)
);

CREATE INDEX IF NOT EXISTS idx_airtime_legs_order
    ON public.airtime_fulfillment_legs(order_id);
-- Partial index: the reconciliation cron only ever scans unfinished legs.
CREATE INDEX IF NOT EXISTS idx_airtime_legs_open
    ON public.airtime_fulfillment_legs(created_at)
    WHERE status IN ('submitting', 'pending');

-- RLS: service role only. Legs hold beneficiary MSISDNs and raw provider payloads and
-- are only ever read server-side (the callback, the cron, /api/admin/airtime).
ALTER TABLE public.airtime_fulfillment_legs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "airtime_fulfillment_legs_service_role_all" ON public.airtime_fulfillment_legs;
CREATE POLICY "airtime_fulfillment_legs_service_role_all"
    ON public.airtime_fulfillment_legs FOR ALL TO service_role USING (true);

-- ─── Admin settings: auto-fulfilment ships OFF ───────────────────────────────
-- Deliberately 'false' on arrival. Airtime is irreversible once sent, so the switch
-- is flipped by a human after a live GHS 1 test per network, not by a deploy.
INSERT INTO public.admin_settings (key, value)
VALUES
    ('airtime_auto_fulfillment_enabled', 'false'),
    ('airtime_auto_mtn',                 'false'),
    ('airtime_auto_telecel',             'false'),
    ('airtime_auto_at',                  'false')
ON CONFLICT (key) DO NOTHING;
