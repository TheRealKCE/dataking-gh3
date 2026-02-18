-- Migration: Comprehensive fix for Shop Guest Access
-- 1. Ensure anonymous role has usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grant SELECT access to anon/authenticated for shop tables
GRANT SELECT ON public.shop_orders TO anon, authenticated;
GRANT SELECT ON public.shop_profiles TO anon, authenticated;

-- 3. DROP and RECREATE RLS policies to ensure no conflicts
-- Shop Orders: Allow public read access (for tracking by phone)
DROP POLICY IF EXISTS "shop_orders_public_read" ON public.shop_orders;
CREATE POLICY "shop_orders_public_read" ON public.shop_orders
    FOR SELECT 
    TO anon, authenticated 
    USING (true);

-- Shop Profiles: Allow public read access (for branding and status linked details)
DROP POLICY IF EXISTS "shop_profiles_public_read" ON public.shop_profiles;
CREATE POLICY "shop_profiles_public_read" ON public.shop_profiles
    FOR SELECT 
    TO anon, authenticated 
    USING (approval_status = 'approved' AND is_active = true);

-- Verify RLS is enabled
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;
