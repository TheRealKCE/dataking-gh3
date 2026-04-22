-- ============================================================================
-- SECURITY HARDENING — DEEP-02 FIX
-- Date: 2026-04-22
-- Covers: Atomic RPC for wallet top-ups to fix read-then-write race condition
-- ============================================================================

CREATE OR REPLACE FUNCTION public.topup_wallet_balance(
  p_user_id uuid,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jwt_role TEXT;
  v_new_balance numeric;
BEGIN
  -- SECURITY: Only callable by server-side service role.
  v_jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    ''
  );

  IF v_jwt_role != 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: topup_wallet_balance requires service_role';
  END IF;

  -- Guard: reject zero or negative amounts
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: amount must be positive';
  END IF;

  UPDATE public.wallets
  SET
    balance = balance + p_amount,
    total_credited = COALESCE(total_credited, 0) + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;
