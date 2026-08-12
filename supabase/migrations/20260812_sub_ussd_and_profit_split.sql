-- ============================================================
-- Sub-Agents: own USSD short code + a working profit split
--
-- 1. A sub-tier price for the one-time USSD short-code purchase. Without it a
--    sub falls through to the `customer` tier (the most expensive one), because
--    a sub's users.role is 'customer' — being a sub is a membership, not a role.
--
-- 2. A corrected credit_shop_order_profits(). The original lives in
--    supabase/sub_agents_rpcs.sql (Phase 2 of the deployment checklist in
--    docs/SUB_AGENTS_IMPLEMENTATION.md) and was never called by application
--    code. Apply that file first if the function is not yet in the live DB —
--    this migration only replaces the body, and the REVOKE/GRANT below stand on
--    their own either way.
-- ============================================================

-- admin_settings.value is JSONB, so the price is a quoted JSON *string* —
-- matching the other ussd_activation_price_* keys and what the admin UI writes.
INSERT INTO public.admin_settings (key, value) VALUES
  ('ussd_activation_price_sub', '"40"')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- credit_shop_order_profits() — atomically credit Sub + Lead
--
-- Two defects in the original are fixed here:
--
--   1. Idempotency keyed on (shop_order_id, type, amount). When the sub's
--      markup happened to equal the Lead's margin, the parent's "already
--      credited?" probe matched the SUB's row and the Lead was silently never
--      paid. Each leg now carries its own `reference` — SUBPROFIT-<id> /
--      LEADPROFIT-<id> — and the unique index idx_shop_wallet_tx_reference on
--      (reference, type) is what claims the credit. The balance only moves
--      after that insert wins, so two concurrent settlements cannot both add.
--
--   2. It refused the whole order when EITHER leg was <= 0. A legitimate order
--      can have a zero sub leg (the Lead raised their price after the sub set
--      theirs). Now only a wholly empty split is refused; a zero leg is skipped
--      and the other leg is still paid.
-- ============================================================

CREATE OR REPLACE FUNCTION public.credit_shop_order_profits(
  p_shop_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- ALIAS FOR positional args: avoids parameter resolution issues under
  -- SECURITY DEFINER + empty search_path (same pattern as the other RPCs).
  _shop_order_id     ALIAS FOR $1;
  v_upline_shop_id   UUID;
  v_sub_profit       DECIMAL;
  v_parent_profit    DECIMAL;
  v_owner_id         UUID;
  v_upline_owner_id  UUID;
  v_wallet_id        UUID;
  v_upline_wallet_id UUID;
  v_sub_ref          TEXT;
  v_parent_ref       TEXT;
  v_rows             INT;
  v_legacy_sub_tx    UUID;
  v_sub_credited     BOOLEAN := FALSE;
  v_parent_credited  BOOLEAN := FALSE;
BEGIN
  -- Serialize concurrent webhooks for the same order.
  PERFORM pg_advisory_xact_lock(hashtext(_shop_order_id::text));

  SELECT
    so.parent_shop_id,
    so.profit,            -- the sub's own markup in storefront mode
    so.parent_profit,
    sp.owner_id,
    sp_upline.owner_id
  INTO
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

  v_sub_profit    := COALESCE(v_sub_profit, 0);
  v_parent_profit := COALESCE(v_parent_profit, 0);

  IF v_sub_profit <= 0 AND v_parent_profit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nothing to credit on this order');
  END IF;

  v_sub_ref    := 'SUBPROFIT-'  || _shop_order_id::text;
  v_parent_ref := 'LEADPROFIT-' || _shop_order_id::text;

  -- ── Sub leg ───────────────────────────────────────────────────────────────
  -- An order settled before this function existed was credited by
  -- credit_shop_profit(), which writes no `reference`. Reference-keyed
  -- idempotency cannot see those rows, so check for one explicitly: without
  -- this, re-processing such an order would pay the sub a second time.
  SELECT id INTO v_legacy_sub_tx
  FROM public.shop_wallet_transactions
  WHERE shop_order_id = _shop_order_id
    AND type = 'profit'
    AND reference IS NULL
  LIMIT 1;

  IF v_sub_profit > 0 AND v_owner_id IS NOT NULL AND v_legacy_sub_tx IS NULL THEN
    INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
    VALUES (v_owner_id, 0, 0)
    ON CONFLICT (owner_id) DO NOTHING;

    SELECT id INTO v_wallet_id
    FROM public.shop_wallets
    WHERE owner_id = v_owner_id;

    -- The ledger insert claims the credit; the balance moves only if it won.
    -- The arbiter index is partial (WHERE reference IS NOT NULL), so the
    -- predicate has to be restated here for Postgres to infer it.
    INSERT INTO public.shop_wallet_transactions
      (shop_wallet_id, shop_order_id, type, amount, description, status, reference)
    VALUES
      (v_wallet_id, _shop_order_id, 'profit', v_sub_profit,
       'Sub storefront sale', 'completed', v_sub_ref)
    ON CONFLICT (reference, type) WHERE reference IS NOT NULL DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      UPDATE public.shop_wallets
      SET balance      = balance + v_sub_profit,
          total_earned = total_earned + v_sub_profit,
          updated_at   = NOW()
      WHERE id = v_wallet_id;
      v_sub_credited := TRUE;
    END IF;
  END IF;

  -- ── Lead leg ──────────────────────────────────────────────────────────────
  IF v_parent_profit > 0 AND v_upline_shop_id IS NOT NULL AND v_upline_owner_id IS NOT NULL THEN
    INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
    VALUES (v_upline_owner_id, 0, 0)
    ON CONFLICT (owner_id) DO NOTHING;

    SELECT id INTO v_upline_wallet_id
    FROM public.shop_wallets
    WHERE owner_id = v_upline_owner_id;

    INSERT INTO public.shop_wallet_transactions
      (shop_wallet_id, shop_order_id, type, amount, description, status, reference)
    VALUES
      (v_upline_wallet_id, _shop_order_id, 'profit', v_parent_profit,
       'Sub network commission', 'completed', v_parent_ref)
    ON CONFLICT (reference, type) WHERE reference IS NOT NULL DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      UPDATE public.shop_wallets
      SET balance      = balance + v_parent_profit,
          total_earned = total_earned + v_parent_profit,
          updated_at   = NOW()
      WHERE id = v_upline_wallet_id;
      v_parent_credited := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sub_credited', v_sub_credited,
    'parent_credited', v_parent_credited,
    'message', CASE
      WHEN v_sub_credited OR v_parent_credited
        THEN 'Credited sub: ' || v_sub_profit || ', lead: ' || v_parent_profit
      ELSE 'Already credited'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_shop_order_profits(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_shop_order_profits(UUID) TO authenticated, service_role;
