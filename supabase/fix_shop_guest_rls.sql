-- Migration: Fix RLS for shop_orders guest access
-- This allows anonymous and authenticated users to read orders (needed for the status tracker)
CREATE POLICY "shop_orders_public_read" ON public.shop_orders
  FOR SELECT TO anon, authenticated
  USING (true);

-- Ensure shop_profiles can also be read by public (already exists, but good to verify)
-- CREATE POLICY "shop_profiles_public_read" ON public.shop_profiles
--   FOR SELECT USING (approval_status = 'approved' AND is_active = true);
