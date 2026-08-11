-- ============================================================
-- Atomic shop wallet EARNING credit
--
-- credit_shop_wallet_balance() exists but is the withdrawal-revert helper: it
-- also decrements total_withdrawn, so using it to book a sale would corrupt
-- withdrawal stats. This is the earnings equivalent — balance and total_earned
-- both go up, in a single statement so concurrent credits cannot lose an update.
-- ============================================================

CREATE OR REPLACE FUNCTION credit_shop_wallet_earning(
    p_owner_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE(
    wallet_id UUID,
    new_balance NUMERIC,
    new_total_earned NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _owner_id ALIAS FOR $1;
    _amount   ALIAS FOR $2;
    v_wallet_id        UUID;
    v_new_balance      NUMERIC;
    v_new_total_earned NUMERIC;
BEGIN
    -- Single statement: no read-modify-write window for a concurrent sale to
    -- overwrite.
    UPDATE public.shop_wallets
    SET
        balance      = COALESCE(balance, 0) + _amount,
        total_earned = COALESCE(total_earned, 0) + _amount,
        updated_at   = NOW()
    WHERE owner_id = _owner_id
    RETURNING id, balance, COALESCE(total_earned, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_earned;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_earned;
END;
$$;

REVOKE ALL ON FUNCTION credit_shop_wallet_earning(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION credit_shop_wallet_earning(UUID, NUMERIC) TO service_role;
