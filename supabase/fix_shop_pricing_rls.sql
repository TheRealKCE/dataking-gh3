-- ============================================================
-- Fix: Admin RLS policy for shop_pricing table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Allow admins to INSERT, UPDATE, DELETE live pricing rows
-- (needed when approving pending pricing submissions)
DROP POLICY IF EXISTS "shop_pricing_admin_write" ON public.shop_pricing;
CREATE POLICY "shop_pricing_admin_write" ON public.shop_pricing
  FOR ALL USING (public.is_admin());

-- Also allow shop owners to read their own live pricing
-- (needed for the pricing page to show current live prices)
DROP POLICY IF EXISTS "shop_pricing_owner_read" ON public.shop_pricing;
CREATE POLICY "shop_pricing_owner_read" ON public.shop_pricing
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid()
    )
  );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
