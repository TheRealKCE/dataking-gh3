-- ============================================================
-- COMPREHENSIVE REPAIR SCRIPT — Reseller Shop System
-- ============================================================

-- 1. SCHEMA REPAIR: Ensure columns exist in orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_order_id UUID REFERENCES public.shop_orders(id) ON DELETE SET NULL;

-- 2. INDEX REPAIR: Ensure performance indices exist
CREATE INDEX IF NOT EXISTS idx_orders_shop_name ON public.orders(shop_name) WHERE shop_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_shop_order_id ON public.orders(shop_order_id) WHERE shop_order_id IS NOT NULL;

-- 3. PERMISSIONS REPAIR: Ensure all roles have correct usage and select access
-- This fixes "406 Not Acceptable" errors by ensuring roles can "see" the tables.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. RLS REPAIR: Drop and recreate clean policies to avoid recursion/conflicts
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

-- Shop Profiles
DROP POLICY IF EXISTS "shop_profiles_owner_all" ON public.shop_profiles;
CREATE POLICY "shop_profiles_owner_all" ON public.shop_profiles
    FOR ALL TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "shop_profiles_public_read" ON public.shop_profiles;
CREATE POLICY "shop_profiles_public_read" ON public.shop_profiles
    FOR SELECT TO anon, authenticated USING (approval_status = 'approved' AND is_active = true);

-- Shop Pricing
DROP POLICY IF EXISTS "shop_pricing_owner_all" ON public.shop_pricing;
CREATE POLICY "shop_pricing_owner_all" ON public.shop_pricing
    FOR ALL TO authenticated USING (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "shop_pricing_public_read" ON public.shop_pricing;
CREATE POLICY "shop_pricing_public_read" ON public.shop_pricing
    FOR SELECT TO anon, authenticated USING (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE approval_status = 'approved' AND is_active = true)
    );

-- Shop Wallets
DROP POLICY IF EXISTS "shop_wallets_owner_read" ON public.shop_wallets;
CREATE POLICY "shop_wallets_owner_read" ON public.shop_wallets
    FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- Shop Orders
DROP POLICY IF EXISTS "shop_orders_owner_read" ON public.shop_orders;
CREATE POLICY "shop_orders_owner_read" ON public.shop_orders
    FOR SELECT TO authenticated USING (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "shop_orders_public_read" ON public.shop_orders;
CREATE POLICY "shop_orders_public_read" ON public.shop_orders
    FOR SELECT TO anon, authenticated USING (true); -- Guest status tracking

-- Shop Wallet Transactions
DROP POLICY IF EXISTS "shop_wallet_transactions_owner_read" ON public.shop_wallet_transactions;
CREATE POLICY "shop_wallet_transactions_owner_read" ON public.shop_wallet_transactions
    FOR SELECT TO authenticated USING (
        shop_wallet_id IN (SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid())
    );

-- 5. BACKFILL: Link existing mirrored orders to shop orders via reference mapping
UPDATE public.orders o
SET shop_order_id = sho.id,
    shop_name = s.shop_name
FROM public.shop_orders sho
JOIN public.shop_profiles s ON s.id = sho.shop_id
WHERE o.reference_code = 'SHOP-' || RIGHT(sho.paystack_reference, 8)
  AND o.shop_order_id IS NULL;

-- 6. SYSTEM ANNOUNCEMENTS (Fixing the 406 for this table too)
GRANT SELECT ON public.system_announcements TO anon, authenticated;
