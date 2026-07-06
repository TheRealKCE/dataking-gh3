-- ============================================================
-- Sub-Agents: Atomic RPCs for Profit Distribution & Withdrawal Approval
-- Security: All SECURITY DEFINER, empty search_path, advisory locks
-- ============================================================

-- ============================================================
-- 1. effective_owner_cost() — Single Source of Truth for Cost Basis
-- ============================================================
-- Consolidated role → cost resolver (shared with TS lib/pricing/cost-basis.ts)
-- Used by: global pricing trigger + adjust_shop_pricing_for_role_change RPC
--
-- Rule:
--   dealer_price   if role='dealer' AND dealer_expires_at > now() AND dealer_price > 0
--   agent_price    if role='agent' AND (agent_expires_at IS NULL OR agent_expires_at > now()) AND agent_price > 0
--   price          otherwise (fallback)

CREATE OR REPLACE FUNCTION public.effective_owner_cost(
  p_package_id UUID,
  p_owner_id UUID
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_package RECORD;
  v_owner RECORD;
  v_now TIMESTAMPTZ;
BEGIN
  v_now := NOW();

  -- Fetch package pricing tiers
  SELECT price, agent_price, dealer_price
  INTO v_package
  FROM public.data_packages
  WHERE id = p_package_id;

  IF NOT FOUND THEN
    RETURN NULL; -- Package not found
  END IF;

  -- Fetch owner state
  SELECT role, agent_expires_at, dealer_expires_at
  INTO v_owner
  FROM public.users
  WHERE id = p_owner_id;

  IF NOT FOUND THEN
    RETURN NULL; -- Owner not found
  END IF;

  -- Dealer: active dealers get dealer_price
  IF v_owner.role = 'dealer'
     AND v_owner.dealer_expires_at > v_now
     AND v_package.dealer_price > 0 THEN
    RETURN v_package.dealer_price;
  END IF;

  -- Agent: lifetime agents (agent_expires_at IS NULL) or non-expired agents get agent_price
  IF v_owner.role = 'agent'
     AND (v_owner.agent_expires_at IS NULL OR v_owner.agent_expires_at > v_now)
     AND v_package.agent_price > 0 THEN
    RETURN v_package.agent_price;
  END IF;

  -- Fallback to customer price
  RETURN v_package.price;
END;
$$;

GRANT EXECUTE ON FUNCTION public.effective_owner_cost(UUID, UUID) TO authenticated, service_role;

-- ============================================================
-- 2. credit_shop_order_profits() — Atomically Credit Sub + Lead
-- ============================================================
-- Called after webhook confirms delivery on a storefront sub sale.
-- Atomically:
--   1. Credit Sub's wallet: sub_profit
--   2. Credit Lead's wallet: parent_profit (upline margin)
--   3. Log transactions with idempotency guards
--
-- Idempotent: re-running after a partial failure is safe (already-credited guard).

CREATE OR REPLACE FUNCTION public.credit_shop_order_profits(
  p_shop_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _shop_order_id    ALIAS FOR $1;
  v_shop_id         UUID;
  v_sub_user_id     UUID;
  v_upline_shop_id  UUID;
  v_sub_profit      DECIMAL;
  v_parent_profit   DECIMAL;
  v_owner_id        UUID;
  v_upline_owner_id UUID;
  v_wallet_id       UUID;
  v_upline_wallet_id UUID;
  v_existing_sub_tx UUID;
  v_existing_parent_tx UUID;
  v_rows_inserted   INT;
BEGIN
  -- 0. Advisory lock: serialize concurrent webhooks for the same order
  PERFORM pg_advisory_xact_lock(hashtext(_shop_order_id::text));

  -- 1. Fetch order details (shop, sub user, upline, profits)
  SELECT
    so.shop_id,
    so.parent_shop_id,
    so.profit,                             -- This is sub_profit in storefront mode
    so.parent_profit,
    sp.owner_id,
    sp_upline.owner_id
  INTO
    v_shop_id,
    v_upline_shop_id,
    v_sub_profit,
    v_parent_profit,
    v_owner_id,
    v_upline_owner_id
  FROM public.shop_orders so
  JOIN public.shop_profiles sp ON so.shop_id = sp.id
  LEFT JOIN public.shop_profiles sp_upline ON so.parent_shop_id = sp_upline.id
  WHERE so.id = _shop_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- 2. Validate profits are positive (storefront mode)
  IF v_sub_profit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sub profit must be > 0');
  END IF;

  IF v_upline_shop_id IS NOT NULL AND v_parent_profit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Parent profit must be > 0 when parent_shop_id is set');
  END IF;

  -- 3. Idempotency check: already credited this order?
  SELECT id INTO v_existing_sub_tx
  FROM public.shop_wallet_transactions
  WHERE shop_order_id = _shop_order_id AND type = 'profit' AND amount = v_sub_profit;

  IF v_existing_sub_tx IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already credited to sub');
  END IF;

  -- 4. Credit Sub's wallet
  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_owner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  SELECT id INTO v_wallet_id
  FROM public.shop_wallets
  WHERE owner_id = v_owner_id;

  UPDATE public.shop_wallets
  SET
    balance      = balance + v_sub_profit,
    total_earned = total_earned + v_sub_profit,
    updated_at   = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, shop_order_id, type, amount, description, status)
  VALUES
    (v_wallet_id, _shop_order_id, 'profit', v_sub_profit,
     'Sub storefront sale',
     'completed');

  -- 5. Credit Lead's wallet (if parent_shop_id is set)
  IF v_upline_shop_id IS NOT NULL AND v_upline_owner_id IS NOT NULL THEN
    -- Check idempotency for parent
    SELECT id INTO v_existing_parent_tx
    FROM public.shop_wallet_transactions
    WHERE shop_order_id = _shop_order_id AND type = 'profit' AND amount = v_parent_profit;

    IF v_existing_parent_tx IS NULL THEN
      INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
      VALUES (v_upline_owner_id, 0, 0)
      ON CONFLICT (owner_id) DO NOTHING;

      SELECT id INTO v_upline_wallet_id
      FROM public.shop_wallets
      WHERE owner_id = v_upline_owner_id;

      UPDATE public.shop_wallets
      SET
        balance      = balance + v_parent_profit,
        total_earned = total_earned + v_parent_profit,
        updated_at   = NOW()
      WHERE id = v_upline_wallet_id;

      INSERT INTO public.shop_wallet_transactions
        (shop_wallet_id, shop_order_id, type, amount, description, status)
      VALUES
        (v_upline_wallet_id, _shop_order_id, 'profit', v_parent_profit,
         'Sub network commission',
         'completed');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Credited sub profit: ' || v_sub_profit || ', parent profit: ' || COALESCE(v_parent_profit, 0)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_shop_order_profits(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_shop_order_profits(UUID) TO authenticated, service_role;

-- ============================================================
-- 3. credit_lead_margin() — Credit Lead on Sub Wallet-Mode Purchases
-- ============================================================
-- Option (a) from R-7: Lightweight attribution for sub wallet-buys.
-- Wallet-mode purchases create orders rows (not shop_orders). The Lead's margin
-- (sub_price - owner_cost) needs its own atomic credit.
--
-- Called after wallet purchase order confirms. Creates a shop_orders-like transaction
-- for accounting purposes and credits the upline's wallet.

CREATE OR REPLACE FUNCTION public.credit_lead_margin(
  p_order_id UUID,
  p_upline_shop_id UUID,
  p_margin_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _order_id        ALIAS FOR $1;
  _upline_shop_id  ALIAS FOR $2;
  _margin_amount   ALIAS FOR $3;
  v_upline_owner_id UUID;
  v_wallet_id       UUID;
  v_existing_tx_id  UUID;
BEGIN
  -- 0. Advisory lock
  PERFORM pg_advisory_xact_lock(hashtext(_order_id::text || _upline_shop_id::text));

  -- 1. Fetch upline owner
  SELECT owner_id
  INTO v_upline_owner_id
  FROM public.shop_profiles
  WHERE id = _upline_shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Upline shop not found');
  END IF;

  -- 2. Validate margin is positive
  IF _margin_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Margin must be > 0');
  END IF;

  -- 3. Idempotency check: already credited this order's margin?
  SELECT id INTO v_existing_tx_id
  FROM public.shop_wallet_transactions
  WHERE shop_order_id = _order_id AND type = 'profit' AND amount = _margin_amount;

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Margin already credited');
  END IF;

  -- 4. Get or create wallet
  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_upline_owner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  SELECT id INTO v_wallet_id
  FROM public.shop_wallets
  WHERE owner_id = v_upline_owner_id;

  -- 5. Credit the margin
  UPDATE public.shop_wallets
  SET
    balance      = balance + _margin_amount,
    total_earned = total_earned + _margin_amount,
    updated_at   = NOW()
  WHERE id = v_wallet_id;

  -- 6. Log the transaction
  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, type, amount, description, status)
  VALUES
    (v_wallet_id, 'profit', _margin_amount,
     'Sub wallet purchase margin (order: ' || _order_id::text || ')',
     'completed');

  RETURN jsonb_build_object('success', true, 'message', 'Credited margin: ' || _margin_amount);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_lead_margin(UUID, UUID, DECIMAL) FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_lead_margin(UUID, UUID, DECIMAL) TO authenticated, service_role;

-- ============================================================
-- 4. approve_sub_withdrawal() — Lead Approves Sub Withdrawal
-- ============================================================
-- Transition a sub withdrawal from 'shop_owner_pending' + 'pending' approval status
-- to 'pending' + 'approved', moving it into the admin payout queue.
--
-- Only the upline Lead can approve their subs' withdrawals.
-- Idempotent: re-running after approval is safe.

CREATE OR REPLACE FUNCTION public.approve_sub_withdrawal(
  p_withdrawal_id UUID,
  p_approval_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _withdrawal_id    ALIAS FOR $1;
  _approval_note    ALIAS FOR $2;
  v_caller_id       UUID;
  v_sub_user_id     UUID;
  v_upline_shop_id  UUID;
  v_upline_owner_id UUID;
  v_withdrawal_status TEXT;
  v_sub_approval_status TEXT;
BEGIN
  -- Get the caller ID
  v_caller_id := auth.uid();

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

REVOKE EXECUTE ON FUNCTION public.approve_sub_withdrawal(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_sub_withdrawal(UUID, TEXT) TO authenticated, service_role;

-- ============================================================
-- 5. reject_sub_withdrawal() — Lead Rejects Sub Withdrawal
-- ============================================================
-- Reject a sub withdrawal by:
--   1. Reversing the wallet deduction (via existing refund RPC or direct UPDATE)
--   2. Marking sub_approval_status = 'rejected'
--   3. Keeping the withdrawal visible for audit

CREATE OR REPLACE FUNCTION public.reject_sub_withdrawal(
  p_withdrawal_id UUID,
  p_rejection_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _withdrawal_id    ALIAS FOR $1;
  _rejection_note   ALIAS FOR $2;
  v_caller_id       UUID;
  v_sub_user_id     UUID;
  v_upline_owner_id UUID;
  v_withdrawal_amount DECIMAL;
  v_withdrawal_status TEXT;
BEGIN
  v_caller_id := auth.uid();

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

  -- 3. Validate state: must be shop_owner_pending
  IF v_withdrawal_status != 'shop_owner_pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal is not in shop_owner_pending state');
  END IF;

  -- 4. Reverse the wallet deduction (refund the sub)
  UPDATE public.shop_wallets
  SET
    balance = balance + v_withdrawal_amount,
    updated_at = NOW()
  WHERE owner_id = v_sub_user_id;

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

REVOKE EXECUTE ON FUNCTION public.reject_sub_withdrawal(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_sub_withdrawal(UUID, TEXT) TO authenticated, service_role;

-- ============================================================
-- End RPC Definitions
-- ============================================================
