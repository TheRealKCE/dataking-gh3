-- Migration: Create hubtel_payment_logs — a durable record of every Hubtel payment attempt.
--
-- Until now the only trace of a Hubtel payment was stdout. The webhook discarded every
-- non-'0000' callback outright, so a FAILED payment left no record anywhere and an admin
-- had no way to answer "did this customer's payment go through?".
--
-- One row per attempt, keyed by client_reference and updated in place as Hubtel reports
-- progress (initiate -> callback / status_check / fulfill), so the admin view reads
-- one line per payment rather than an event firehose.

CREATE TABLE IF NOT EXISTS public.hubtel_payment_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_reference  TEXT NOT NULL UNIQUE,
    -- wallet | shop | data | results_checker | boost | agent_upgrade
    -- | dealer_subscription | ussd | unknown
    flow              TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'success', 'failed')),
    -- Which Hubtel interaction last touched this row
    stage             TEXT NOT NULL DEFAULT 'initiate'
                        CHECK (stage IN ('initiate', 'callback', 'status_check', 'fulfill')),
    amount            NUMERIC(12,2),
    channel           TEXT,          -- mtn-gh | vodafone-gh | tigo-gh
    payer_msisdn      TEXT,
    customer_name     TEXT,
    transaction_id    TEXT,          -- Hubtel TransactionId
    response_code     TEXT,          -- '0001' | '0000' | '2001' | ...
    message           TEXT,          -- Hubtel Message / our failure reason
    user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
    raw_initiate      JSONB,
    raw_callback      JSONB,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hubtel_payment_logs_created_at
    ON public.hubtel_payment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hubtel_payment_logs_status
    ON public.hubtel_payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_hubtel_payment_logs_msisdn
    ON public.hubtel_payment_logs(payer_msisdn);
CREATE INDEX IF NOT EXISTS idx_hubtel_payment_logs_txn
    ON public.hubtel_payment_logs(transaction_id);

-- RLS: service role only. The table holds customer MSISDNs and raw provider payloads,
-- and is read exclusively through /api/admin/hubtel-payments (service-role client behind
-- an admin check) — never from the browser client.
ALTER TABLE public.hubtel_payment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hubtel_payment_logs_service_role_all" ON public.hubtel_payment_logs;
CREATE POLICY "hubtel_payment_logs_service_role_all"
    ON public.hubtel_payment_logs FOR ALL TO service_role USING (true);
