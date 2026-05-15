-- Function to safely and atomically credit shop profit
-- Usage: supabase.rpc('credit_shop_profit', { p_shop_order_id: '...' })

CREATE OR REPLACE FUNCTION public.credit_shop_profit(p_shop_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- ALIAS FOR avoids parameter resolution issues with SECURITY DEFINER + empty search_path
  _shop_order_id   ALIAS FOR $1;
  v_profit         DECIMAL;
  v_owner_id       UUID;
  v_wallet_id      UUID;
  v_guest_phone    TEXT;
  v_network        TEXT;
  v_package_size   TEXT;
  v_existing_tx_id UUID;
  v_rows_inserted  INT;
BEGIN
  -- 0. Advisory lock: serialise concurrent calls for the same order
  --    Prevents two simultaneous webhooks from double-crediting the same order
  PERFORM pg_advisory_xact_lock(hashtext(_shop_order_id::text));

  -- 1. Fetch Order & Owner Details
  SELECT 
    so.profit, 
    sp.owner_id, 
    so.network, 
    so.package_size, 
    so.guest_phone
  INTO 
    v_profit, 
    v_owner_id, 
    v_network, 
    v_package_size, 
    v_guest_phone
  FROM public.shop_orders so
  JOIN public.shop_profiles sp ON so.shop_id = sp.id
  WHERE so.id = _shop_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF v_profit <= 0 OR v_profit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No profit to credit');
  END IF;

  -- 2. Idempotency Check (safe after advisory lock — no race between check and insert)
  SELECT id INTO v_existing_tx_id
  FROM public.shop_wallet_transactions
  WHERE shop_order_id = _shop_order_id AND type = 'profit';

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already credited');
  END IF;

  -- 3. Get or Create Wallet (Atomic Upsert)
  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_owner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  SELECT id INTO v_wallet_id
  FROM public.shop_wallets
  WHERE owner_id = v_owner_id;

  -- 4. Atomic Balance Update
  UPDATE public.shop_wallets
  SET 
    balance      = balance + v_profit,
    total_earned = total_earned + v_profit,
    updated_at   = NOW()
  WHERE id = v_wallet_id;

  -- 5. Log Transaction
  INSERT INTO public.shop_wallet_transactions 
    (shop_wallet_id, shop_order_id, type, amount, description, status)
  VALUES 
    (v_wallet_id, _shop_order_id, 'profit', v_profit,
     'Sale: ' || COALESCE(v_network, '') || ' ' || COALESCE(v_package_size, '') || ' to ' || COALESCE(v_guest_phone, 'Guest'),
     'completed');

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  IF v_rows_inserted = 0 THEN
    -- Shouldn't happen after advisory lock, but guard anyway
    RETURN jsonb_build_object('success', true, 'message', 'Already credited (concurrent)');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Credited ' || v_profit);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

