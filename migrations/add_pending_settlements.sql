-- Migration: Add pending_settlements table
-- Purpose: Track credit-before-payment transactions (Post-Pay / Debt Tracker)
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.pending_settlements (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    wallet_transaction_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
    amount_owed           numeric(10, 2) NOT NULL CHECK (amount_owed > 0),
    amount_settled        numeric(10, 2) NOT NULL DEFAULT 0 CHECK (amount_settled >= 0),
    status                text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'partially_settled', 'settled')),
    payment_method        text NULL,
    notes                 text NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    settled_at            timestamptz NULL,

    -- Ensure amount_settled never exceeds amount_owed
    CONSTRAINT settled_cannot_exceed_owed CHECK (amount_settled <= amount_owed)
);

-- Row Level Security
ALTER TABLE public.pending_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only access" ON public.pending_settlements
    USING (
        auth.uid() IN (
            SELECT id FROM public.users WHERE role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM public.users WHERE role = 'admin'
        )
    );

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_pending_settlements_user_status
    ON public.pending_settlements (user_id, status);

CREATE INDEX IF NOT EXISTS idx_pending_settlements_status_created
    ON public.pending_settlements (status, created_at DESC);

-- Comment for documentation
COMMENT ON TABLE public.pending_settlements IS
    'Tracks wallet credits where payment was not received upfront (credit/post-pay debts).';
