-- ============================================================================
-- Moolre Withdrawal Integration Schema
-- Adds columns to shop_wallet_transactions and shop_payment_details
-- to support automated MoMo/Bank payouts via Moolre Transfer API.
-- ============================================================================

-- ─── shop_wallet_transactions ────────────────────────────────────────────────

-- Moolre's own internal transaction ID (returned on successful transfer)
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS moolre_transaction_id TEXT;

-- The externalref we sent to Moolre (= shop_wallet_transactions.id)
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS moolre_external_ref TEXT;

-- Raw txstatus integer from Moolre (1=completed, 0=pending, 2=failed, 3=pending)
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS moolre_status INTEGER;

-- 'momo' (default) or 'bank' — determines payment pathway
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'momo';

-- Bank sublist ID — only populated for bank transfer withdrawals
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS bank_id TEXT;

-- Bank account number — separated from momo_number for data integrity
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Timestamp when Moolre confirmed the transfer as completed
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- ─── status constraint update ─────────────────────────────────────────────────
-- Drop any existing check constraint on status so we can re-create it cleanly.
-- The new allowed values are: pending, moolre_pending, completed
DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    SELECT conname INTO v_constraint
    FROM pg_constraint
    WHERE conrelid = 'public.shop_wallet_transactions'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%';

    IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.shop_wallet_transactions DROP CONSTRAINT %I', v_constraint);
    END IF;
END;
$$;

ALTER TABLE public.shop_wallet_transactions
    ADD CONSTRAINT shop_wallet_transactions_status_check
    CHECK (status IN ('pending', 'moolre_pending', 'completed'));

-- ─── shop_payment_details ─────────────────────────────────────────────────────

-- 'momo' (default) or 'bank'
ALTER TABLE public.shop_payment_details
    ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'momo';

-- Bank sublist ID for bank-transfer saved methods
ALTER TABLE public.shop_payment_details
    ADD COLUMN IF NOT EXISTS bank_id TEXT;

-- Bank account number for saved methods
ALTER TABLE public.shop_payment_details
    ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Human-readable bank name, stored at save time so UI doesn't need to re-fetch
ALTER TABLE public.shop_payment_details
    ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- ─── Indexes for cron performance ────────────────────────────────────────────
-- Cron job queries exclusively on moolre_pending — make it fast
CREATE INDEX IF NOT EXISTS idx_shop_wallet_tx_moolre_pending
    ON public.shop_wallet_transactions (status)
    WHERE status = 'moolre_pending';
