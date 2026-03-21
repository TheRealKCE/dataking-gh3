-- Add date_of_birth column to existing table
ALTER TABLE public.afa_orders ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Replace RPC to include date_of_birth
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
        date_of_birth,
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
        (p_form_data->>'date_of_birth')::DATE,
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
