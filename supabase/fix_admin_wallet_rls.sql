-- ============================================================
-- Grant Admin Access to Shop Wallets and Transactions
-- ============================================================

-- 1. Shop Wallets RLS
-- Allow admins to see all shop wallets
CREATE POLICY "Admins view all shop wallets"
ON public.shop_wallets
FOR SELECT
USING ( public.is_admin() );

-- 2. Shop Wallet Transactions RLS
-- Allow admins to see all transactions
CREATE POLICY "Admins view all shop transaction history"
ON public.shop_wallet_transactions
FOR SELECT
USING ( public.is_admin() );

-- Allow admins to update transactions (e.g., approve/reject withdrawals)
CREATE POLICY "Admins update shop transactions"
ON public.shop_wallet_transactions
FOR UPDATE
USING ( public.is_admin() );

-- 3. Shop Global Settings RLS
-- Ensure admins can manage global settings if not already covered
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shop_global_settings' AND policyname = 'Admins manage global settings'
  ) THEN
    CREATE POLICY "Admins manage global settings"
    ON public.shop_global_settings
    FOR ALL
    USING ( public.is_admin() );
  END IF;
END
$$;

-- Allow authenticated users to read global settings (needed for storefronts and dashboards)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shop_global_settings' AND policyname = 'Anyone can view global settings'
  ) THEN
    CREATE POLICY "Anyone can view global settings"
    ON public.shop_global_settings
    FOR SELECT
    TO authenticated, anon
    USING ( true );
  END IF;
END
$$;
