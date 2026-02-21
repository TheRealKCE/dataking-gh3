-- ============================================================
-- SHOP ORDERS FIX — Run this once in Supabase SQL Editor
-- Fixes: storefront order tracker + shop orders dashboard
-- ============================================================

-- 1. Ensure anon/authenticated can call the order-tracking RPC
--    (Without this, unauthenticated visitors get a permission error)
GRANT EXECUTE ON FUNCTION public.get_shop_orders_by_phone(text, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shop_orders_by_phone(text, int) TO authenticated;

-- 2. Ensure schema usage and table read access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.shop_orders TO anon, authenticated;
GRANT SELECT ON public.shop_profiles TO anon, authenticated;

-- 3. RLS: Allow shop owners to read their OWN shop profile
--    (needed so fetchOrders can find the shopId for the logged-in owner)
DROP POLICY IF EXISTS "shop_profiles_owner_read" ON public.shop_profiles;
CREATE POLICY "shop_profiles_owner_read" ON public.shop_profiles
    FOR SELECT TO authenticated
    USING (owner_id = auth.uid());

-- 4. RLS: Allow shop owners to read their own shop's orders
DROP POLICY IF EXISTS "shop_orders_owner_read" ON public.shop_orders;
CREATE POLICY "shop_orders_owner_read" ON public.shop_orders
    FOR SELECT TO authenticated
    USING (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
    );

-- 4. RLS: Allow public (anon) to read any shop order — needed for the
--    /shop/status tracker where customers look up orders by phone
DROP POLICY IF EXISTS "shop_orders_public_read" ON public.shop_orders;
CREATE POLICY "shop_orders_public_read" ON public.shop_orders
    FOR SELECT TO anon, authenticated
    USING (true);

-- 5. Ensure RLS is enabled on shop_orders
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
