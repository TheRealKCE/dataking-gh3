-- ============================================================
-- Atomic Wallet Deduction RPC
-- Prevents double-spend race conditions by combining
-- balance check and deduction into a single atomic operation.
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_wallet_balance(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE(
    wallet_id UUID,
    new_balance NUMERIC,
    new_total_spent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
    v_new_balance NUMERIC;
    v_new_total_spent NUMERIC;
BEGIN
    -- Atomic: UPDATE with WHERE balance >= amount
    -- If balance is insufficient, no rows are updated.
    UPDATE wallets
    SET
        balance = balance - p_amount,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND balance >= p_amount
    RETURNING id, balance, COALESCE(total_spent, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_spent;

    -- If no row was updated, the balance was insufficient
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_spent;
END;
$$;
