-- Function to safely delete an entire shop and its associated data
-- Usage: supabase.rpc('delete_shop_data')

CREATE OR REPLACE FUNCTION public.delete_shop_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_shop_id UUID;
  v_wallet_id UUID;
BEGIN
  v_owner_id := auth.uid();
  
  IF v_owner_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- 1. Identify shop and wallet
  SELECT id INTO v_shop_id FROM public.shop_profiles WHERE owner_id = v_owner_id;
  SELECT id INTO v_wallet_id FROM public.shop_wallets WHERE owner_id = v_owner_id;

  IF v_shop_id IS NULL AND v_wallet_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'No shop found to delete');
  END IF;

  -- 2. Delete Wallet (Cascades to Transactions)
  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM public.shop_wallets WHERE id = v_wallet_id;
  END IF;

  -- 3. Delete Profile (Cascades to Orders, Pricing)
  IF v_shop_id IS NOT NULL THEN
    DELETE FROM public.shop_profiles WHERE id = v_shop_id;
  END IF;
  
  -- 4. Clean up any orphaned Shop Orders (just in case)
  -- (Though partial shop deletion without profile shouldn't happen, good to be safe)
  -- DELETE FROM public.shop_orders WHERE shop_id = v_shop_id; -- Handled by CASCADE

  RETURN jsonb_build_object('success', true, 'message', 'Shop deleted successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
