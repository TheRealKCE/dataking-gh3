-- Migration: Utility bill payments (DSTV, GOtv, StarTimes, ECG, Ghana Water).
--
-- These run on the SAME Hubtel Commission Services API as airtime — same prepaid
-- account, same credentials, same Fixie IP whitelist — just a different service ID
-- per utility. What makes them a separate table rather than rows in airtime_orders
-- is the query step: a bill payment resolves an account number to a customer NAME
-- before any money moves, and that name (plus, for Ghana Water, a single-use
-- sessionId) has to be recorded on the order.
--
-- No legs table here, unlike airtime. Hubtel caps one airtime top-up at GHS 100 and
-- an order above that is split; the utility endpoints document no ceiling, so one
-- order is one request. The irreversibility problem is the same though, so
-- dispatch_claimed_at is the idempotency latch that airtime's UNIQUE (order_id,
-- leg_index) provides: the dispatcher wins it with a conditional UPDATE before it
-- calls Hubtel, and a second invocation gets no row back and sends nothing.

CREATE TABLE IF NOT EXISTS public.utility_orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_role             TEXT NOT NULL DEFAULT 'customer',

    service               TEXT NOT NULL
                            CHECK (service IN ('dstv', 'gotv', 'startimes', 'ecg', 'ghanawater')),

    -- What the customer is paying FOR: smartcard / IUC / meter number. For ECG this
    -- is the meter picked out of the list the query returned, not the phone number.
    account_number        TEXT NOT NULL,
    -- Snapshotted from the query at charge time. The receipt has to be able to say
    -- who was paid even after the provider's records move on.
    account_name          TEXT,
    -- Exactly what goes in Hubtel's `Destination` field: the account for TV, the
    -- MSISDN for ECG and Ghana Water. Stored resolved so the dispatcher never has to
    -- re-derive it and get the per-service rule wrong.
    destination           TEXT NOT NULL,

    customer_phone        TEXT,
    customer_email        TEXT,          -- Ghana Water only (mandatory there)
    -- Ghana Water only. Single-use, issued by the query, spent by the payment.
    session_id            TEXT,

    bill_amount           NUMERIC(12,2) NOT NULL CHECK (bill_amount > 0),
    fee_rate              NUMERIC(5,2)  NOT NULL DEFAULT 0,
    fee_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_paid            NUMERIC(12,2) NOT NULL CHECK (total_paid > 0),

    payment_method        TEXT NOT NULL DEFAULT 'wallet'
                            CHECK (payment_method IN ('wallet', 'gateway')),
    payment_status        TEXT NOT NULL DEFAULT 'paid'
                            CHECK (payment_status IN ('pending', 'paid', 'refunded')),

    -- refunded = we took the money, Hubtel would not pay the bill, the wallet has
    -- been credited back. Distinct from 'failed' so an admin can tell at a glance
    -- whether the customer is still owed anything.
    status                TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),

    reference_code        TEXT NOT NULL UNIQUE,
    -- Sent to Hubtel and echoed back on the callback. Separate from reference_code
    -- because the gateway-funded path uses reference_code as the COLLECTION
    -- reference, and the two must not collide in the payment log.
    client_reference      TEXT UNIQUE,

    dispatch_claimed_at   TIMESTAMPTZ,

    provider              TEXT,           -- 'hubtel' once dispatched
    transaction_id        TEXT,
    external_transaction_id TEXT,
    commission            NUMERIC(12,4),
    response_code         TEXT,
    provider_response     JSONB,

    fulfillment_note      TEXT,
    fulfilled_by          UUID REFERENCES public.users(id),
    fulfilled_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_utility_orders_user       ON public.utility_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_utility_orders_status     ON public.utility_orders(status);
CREATE INDEX IF NOT EXISTS idx_utility_orders_created    ON public.utility_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_utility_orders_reference  ON public.utility_orders(reference_code);
CREATE INDEX IF NOT EXISTS idx_utility_orders_client_ref ON public.utility_orders(client_reference);
CREATE INDEX IF NOT EXISTS idx_utility_orders_service    ON public.utility_orders(service);

-- Partial index: the reconciliation cron only ever scans unfinished orders.
CREATE INDEX IF NOT EXISTS idx_utility_orders_open
    ON public.utility_orders(created_at)
    WHERE status IN ('pending', 'processing');

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Same shape as airtime_orders. provider_response holds raw Hubtel payloads, so
-- reads of that column only ever happen server-side (service role bypasses RLS).
ALTER TABLE public.utility_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own utility orders" ON public.utility_orders;
CREATE POLICY "Users can view own utility orders" ON public.utility_orders
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create utility orders" ON public.utility_orders;
CREATE POLICY "Users can create utility orders" ON public.utility_orders
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all utility orders" ON public.utility_orders;
CREATE POLICY "Admins can view all utility orders" ON public.utility_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = (SELECT auth.uid())
              AND u.role IN ('admin', 'sub-admin')
        )
    );

DROP POLICY IF EXISTS "Admins can update utility orders" ON public.utility_orders;
CREATE POLICY "Admins can update utility orders" ON public.utility_orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = (SELECT auth.uid())
              AND u.role IN ('admin', 'sub-admin')
        )
    );

-- ─── Admin settings ──────────────────────────────────────────────────────────
-- Per-service availability, pricing and limits. Fees are a percentage on top of the
-- bill, matching how airtime is priced — 2% customer / 1% agent to start, tuned in
-- /admin/settings without a deploy.
--
-- Every utility_auto_* flag ships 'false' for the same reason airtime's did: a bill
-- payment cannot be recalled, so the switch is flipped by a human after a live GHS 1
-- test per service.
INSERT INTO public.admin_settings (key, value) VALUES
    ('utility_enabled_dstv',        'true'),
    ('utility_enabled_gotv',        'true'),
    ('utility_enabled_startimes',   'true'),
    ('utility_enabled_ecg',         'true'),
    ('utility_enabled_ghanawater',  'true'),

    ('utility_fee_dstv_customer',       '2'),
    ('utility_fee_dstv_agent',          '1'),
    ('utility_fee_gotv_customer',       '2'),
    ('utility_fee_gotv_agent',          '1'),
    ('utility_fee_startimes_customer',  '2'),
    ('utility_fee_startimes_agent',     '1'),
    ('utility_fee_ecg_customer',        '2'),
    ('utility_fee_ecg_agent',           '1'),
    ('utility_fee_ghanawater_customer', '2'),
    ('utility_fee_ghanawater_agent',    '1'),

    ('utility_min_amount_dstv',        '1'),
    ('utility_max_amount_dstv',        '2000'),
    ('utility_min_amount_gotv',        '1'),
    ('utility_max_amount_gotv',        '2000'),
    ('utility_min_amount_startimes',   '1'),
    ('utility_max_amount_startimes',   '2000'),
    ('utility_min_amount_ecg',         '1'),
    ('utility_max_amount_ecg',         '2000'),
    ('utility_min_amount_ghanawater',  '1'),
    ('utility_max_amount_ghanawater',  '2000'),

    ('utility_auto_fulfillment_enabled', 'false'),
    ('utility_auto_dstv',                'false'),
    ('utility_auto_gotv',                'false'),
    ('utility_auto_startimes',           'false'),
    ('utility_auto_ecg',                 'false'),
    ('utility_auto_ghanawater',          'false'),

    ('page_access_utilities', 'true')
ON CONFLICT (key) DO NOTHING;
