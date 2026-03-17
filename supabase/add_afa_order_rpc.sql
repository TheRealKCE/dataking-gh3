-- ============================================================
-- AFA Order Processing: Schema Upgrades + Atomic RPC
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1A: Add metadata column to wallet_transactions
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ────────────────────────────────────────────────────────────
-- STEP 1B: Performance index on metadata category
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_category
    ON public.wallet_transactions ((metadata->>'category'));

-- ────────────────────────────────────────────────────────────
-- STEP 1C: Upgrade afa_orders table
-- ────────────────────────────────────────────────────────────

-- Add reference_code (nullable first — safe for existing rows)
ALTER TABLE public.afa_orders
    ADD COLUMN IF NOT EXISTS reference_code TEXT;

-- Backfill existing rows so NOT NULL constraint doesn't fail
UPDATE public.afa_orders
    SET reference_code = id::TEXT
    WHERE reference_code IS NULL;

-- Now enforce NOT NULL and UNIQUE
ALTER TABLE public.afa_orders
    ALTER COLUMN reference_code SET NOT NULL;

ALTER TABLE public.afa_orders
    ADD CONSTRAINT afa_orders_reference_code_unique UNIQUE (reference_code);

-- Add transaction_id foreign key link to financial ledger
ALTER TABLE public.afa_orders
    ADD COLUMN IF NOT EXISTS transaction_id UUID
    REFERENCES public.wallet_transactions(id);

-- ────────────────────────────────────────────────────────────
-- STEP 1D: Atomic RPC — process_afa_order
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_afa_order(
    p_user_id       UUID,
    p_amount        NUMERIC,
    p_form_data     JSONB,
    p_reference_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id      UUID;
    v_wallet_balance NUMERIC;
    v_new_balance    NUMERIC;
    v_transaction_id UUID;
    v_order_id       UUID;
BEGIN
    -- Step 1: Lock the wallet row to prevent race conditions
    SELECT id, balance
        INTO v_wallet_id, v_wallet_balance
        FROM public.wallets
        WHERE user_id = p_user_id
        FOR UPDATE;

    -- Step 2: Validate balance
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    IF v_wallet_balance < p_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    -- Step 3: Deduct wallet balance
    UPDATE public.wallets
        SET
            balance     = balance - p_amount,
            total_spent = COALESCE(total_spent, 0) + p_amount,
            updated_at  = NOW()
        WHERE id = v_wallet_id
        RETURNING balance INTO v_new_balance;

    -- Step 4: Insert wallet transaction record (visible in user history + admin finance)
    INSERT INTO public.wallet_transactions (
        wallet_id,
        user_id,
        type,
        amount,
        description,
        reference,
        source,
        status,
        metadata
    ) VALUES (
        v_wallet_id,
        p_user_id,
        'debit',
        p_amount,
        'MTN AFA Registration Fee',
        p_reference_code,
        'purchase',
        'completed',
        jsonb_build_object(
            'category', 'afa_order',
            'source',   'afa_registration'
        )
    )
    RETURNING id INTO v_transaction_id;

    -- Step 5: Insert AFA order record linked to transaction
    INSERT INTO public.afa_orders (
        user_id,
        full_name,
        phone,
        ghana_card,
        id_type,
        id_number,
        location,
        region,
        occupation,
        notes,
        status,
        payment_amount,
        reference_code,
        transaction_id
    ) VALUES (
        p_user_id,
        p_form_data->>'full_name',
        p_form_data->>'phone',
        p_form_data->>'id_number',   -- backward compat: ghana_card = id_number
        p_form_data->>'id_type',
        p_form_data->>'id_number',
        p_form_data->>'location',
        p_form_data->>'region',
        'Farmer',
        p_form_data->>'notes',
        'pending',
        p_amount,
        p_reference_code,
        v_transaction_id
    )
    RETURNING id INTO v_order_id;

    -- Step 6: Return consistent response shape
    RETURN json_build_object(
        'order_id',       v_order_id,
        'transaction_id', v_transaction_id,
        'new_balance',    v_new_balance
    );
END;
$$;
