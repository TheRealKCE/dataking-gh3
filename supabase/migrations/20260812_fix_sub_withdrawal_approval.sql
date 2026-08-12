-- ============================================================
-- Fix: a Lead could never actually approve or reject a sub withdrawal
--
-- approve_sub_withdrawal() / reject_sub_withdrawal() open with
-- `v_caller_id := auth.uid()` and bail with "Not authenticated" when it is
-- NULL. Both are only ever called from route handlers that use the SERVICE
-- ROLE client (app/api/shop/sub-withdrawals/{approve,reject}), where there is
-- no session and auth.uid() is therefore always NULL. Every approval returned
-- success:false, and because the routes only checked for a Postgres *error*
-- they reported HTTP 200 "approved" while the row never moved out of
-- shop_owner_pending -- leaving the sub debited and no payout queued.
--
-- The caller is now passed in explicitly. auth.uid() remains the fallback, so
-- a future session-based caller keeps working unchanged. Authorisation is NOT
-- weakened: the check that the caller owns the upline shop still runs below,
-- and the route re-verifies it before calling.
--
-- Signature changes from 2 to 3 args, so the old one must be DROPped rather
-- than replaced -- two overloads would make the PostgREST call ambiguous.
-- ============================================================

DROP FUNCTION IF EXISTS public.approve_sub_withdrawal(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_sub_withdrawal(UUID, TEXT);


-- ============================================================
-- approve_sub_withdrawal() — Lead approves; moves to the admin payout queue
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_sub_withdrawal(
  p_withdrawal_id UUID,
  p_approval_note TEXT DEFAULT NULL,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _withdrawal_id    ALIAS FOR $1;
  _approval_note    ALIAS FOR $2;
  _caller_id        ALIAS FOR $3;
  v_caller_id       UUID;
  v_sub_user_id     UUID;
  v_upline_shop_id  UUID;
  v_upline_owner_id UUID;
  v_withdrawal_status TEXT;
  v_sub_approval_status TEXT;
BEGIN
  -- Explicit caller first, session second.
  v_caller_id := COALESCE(_caller_id, auth.uid());

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- 1. Fetch withdrawal + ownership chain
  SELECT
    sw.owner_id,
    sa.upline_shop_id,
    sp.owner_id,
    swt.status,
    swt.sub_approval_status
  INTO
    v_sub_user_id,
    v_upline_shop_id,
    v_upline_owner_id,
    v_withdrawal_status,
    v_sub_approval_status
  FROM public.shop_wallet_transactions swt
  JOIN public.shop_wallets sw ON swt.shop_wallet_id = sw.id
  JOIN public.sub_agents sa ON sw.owner_id = sa.user_id
  JOIN public.shop_profiles sp ON sa.upline_shop_id = sp.id
  WHERE swt.id = _withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal or sub not found');
  END IF;

  -- 2. Auth: only the upline Lead can approve
  IF v_upline_owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the Lead can approve');
  END IF;

  -- 3. Validate state: must be shop_owner_pending + pending approval
  IF v_withdrawal_status != 'shop_owner_pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal is not in shop_owner_pending state');
  END IF;

  IF v_sub_approval_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal is not awaiting approval');
  END IF;

  -- 4. Update: transition to 'pending' + 'approved'
  UPDATE public.shop_wallet_transactions
  SET
    status = 'pending',
    sub_approval_status = 'approved',
    sub_approved_by = v_caller_id,
    sub_approval_note = _approval_note,
    updated_at = NOW()
  WHERE id = _withdrawal_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Withdrawal approved and moved to admin payout queue'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_sub_withdrawal(UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_sub_withdrawal(UUID, TEXT, UUID) TO authenticated, service_role;


-- ============================================================
-- reject_sub_withdrawal() — Lead rejects; refunds the sub
-- ============================================================

CREATE OR REPLACE FUNCTION public.reject_sub_withdrawal(
  p_withdrawal_id UUID,
  p_rejection_note TEXT DEFAULT NULL,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _withdrawal_id    ALIAS FOR $1;
  _rejection_note   ALIAS FOR $2;
  _caller_id        ALIAS FOR $3;
  v_caller_id       UUID;
  v_sub_user_id     UUID;
  v_upline_owner_id UUID;
  v_withdrawal_amount DECIMAL;
  v_withdrawal_status TEXT;
BEGIN
  v_caller_id := COALESCE(_caller_id, auth.uid());

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- 1. Fetch withdrawal + ownership chain
  SELECT
    sw.owner_id,
    sp.owner_id,
    swt.status,
    swt.amount
  INTO
    v_sub_user_id,
    v_upline_owner_id,
    v_withdrawal_status,
    v_withdrawal_amount
  FROM public.shop_wallet_transactions swt
  JOIN public.shop_wallets sw ON swt.shop_wallet_id = sw.id
  JOIN public.sub_agents sa ON sw.owner_id = sa.user_id
  JOIN public.shop_profiles sp ON sa.upline_shop_id = sp.id
  WHERE swt.id = _withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal or sub not found');
  END IF;

  -- 2. Auth: only the upline Lead can reject
  IF v_upline_owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the Lead can reject');
  END IF;

  -- 3. Validate state: must be shop_owner_pending. This is also what makes the
  --    refund below single-shot -- a second call sees 'rejected' and stops.
  IF v_withdrawal_status != 'shop_owner_pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal is not in shop_owner_pending state');
  END IF;

  -- 4. Refund the sub through the existing revert helper rather than a bare
  --    balance UPDATE. The request debited via deduct_shop_wallet_balance(),
  --    which also ADDS to total_withdrawn; only this helper backs that out, so
  --    a hand-rolled UPDATE left the sub's "Total Withdrawn" permanently
  --    inflated by money they never received.
  PERFORM public.credit_shop_wallet_balance(v_sub_user_id, v_withdrawal_amount);

  -- 5. Mark as rejected
  UPDATE public.shop_wallet_transactions
  SET
    status = 'rejected',
    sub_approval_status = 'rejected',
    sub_approved_by = v_caller_id,
    sub_approval_note = _rejection_note,
    updated_at = NOW()
  WHERE id = _withdrawal_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Withdrawal rejected and refunded to sub'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_sub_withdrawal(UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_sub_withdrawal(UUID, TEXT, UUID) TO authenticated, service_role;
