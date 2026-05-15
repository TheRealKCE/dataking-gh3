-- ============================================================
-- Atomic Shop Wallet Deduction RPC
-- Prevents double-spend race conditions for shop owners.
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_shop_wallet_balance(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE(
    wallet_id UUID,
    new_balance NUMERIC,
    new_total_withdrawn NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    -- Use ALIAS FOR positional args to avoid parameter resolution issues
    -- with SECURITY DEFINER + empty search_path
    _user_id  ALIAS FOR $1;
    _amount   ALIAS FOR $2;
    v_wallet_id           UUID;
    v_new_balance         NUMERIC;
    v_new_total_withdrawn NUMERIC;
BEGIN
    -- Atomic: UPDATE with WHERE balance >= amount (single statement = no race condition)
    UPDATE public.shop_wallets
    SET
        balance          = balance - _amount,
        total_withdrawn  = COALESCE(total_withdrawn, 0) + _amount,
        updated_at       = NOW()
    WHERE owner_id = _user_id
      AND balance   >= _amount
    RETURNING id, balance, COALESCE(total_withdrawn, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_withdrawn;

    -- If no row was updated, the balance was insufficient
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_withdrawn;
END;
$$;


-- ============================================================
-- Atomic Shop Wallet Credit RPC
-- Used to revert a deduction if transaction insertion fails
-- ============================================================

CREATE OR REPLACE FUNCTION credit_shop_wallet_balance(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE(
    wallet_id UUID,
    new_balance NUMERIC,
    new_total_withdrawn NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _user_id  ALIAS FOR $1;
    _amount   ALIAS FOR $2;
    v_wallet_id           UUID;
    v_new_balance         NUMERIC;
    v_new_total_withdrawn NUMERIC;
BEGIN
    -- Atomic: UPDATE to add balance back and subtract from total_withdrawn
    UPDATE public.shop_wallets
    SET
        balance         = balance + _amount,
        total_withdrawn = COALESCE(total_withdrawn, 0) - _amount,
        updated_at      = NOW()
    WHERE owner_id = _user_id
    RETURNING id, balance, COALESCE(total_withdrawn, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_withdrawn;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_withdrawn;
END;
$$;
