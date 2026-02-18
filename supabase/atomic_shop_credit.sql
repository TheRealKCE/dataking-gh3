-- Function to safely and atomically credit shop profit
-- Usage: supabase.rpc('credit_shop_profit', { p_shop_order_id: '...' })

CREATE OR REPLACE FUNCTION public.credit_shop_profit(p_shop_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profit DECIMAL;
  v_owner_id UUID;
  v_wallet_id UUID;
  v_shop_name TEXT;
  v_guest_phone TEXT;
  v_network TEXT;
  v_package_size TEXT;
  v_existing_tx_id UUID;
BEGIN
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
  WHERE so.id = p_shop_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF v_profit <= 0 OR v_profit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No profit to credit');
  END IF;

  -- 2. Idempotency Check: Don't credit if already credited
  SELECT id INTO v_existing_tx_id
  FROM public.shop_wallet_transactions
  WHERE shop_order_id = p_shop_order_id AND type = 'profit';

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already credited');
  END IF;

  -- 3. Get or Create Wallet (Atomic Upsert strategy)
  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_owner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  -- Lock and Select Wallet ID
  SELECT id INTO v_wallet_id
  FROM public.shop_wallets
  WHERE owner_id = v_owner_id;

  -- 4. Atomic Balance Update
  UPDATE public.shop_wallets
  SET 
    balance = balance + v_profit,
    total_earned = total_earned + v_profit,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 5. Log Transaction
  INSERT INTO public.shop_wallet_transactions 
    (shop_wallet_id, shop_order_id, type, amount, description, status)
  VALUES 
    (v_wallet_id, p_shop_order_id, 'profit', v_profit, 'Sale: ' || v_network || ' ' || v_package_size || ' to ' || v_guest_phone, 'completed');

  RETURN jsonb_build_object('success', true, 'message', 'Credited ' || v_profit);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
