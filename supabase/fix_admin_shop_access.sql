-- ============================================================
-- Fix Admin Access to Shop Profiles
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Allow Admins and Sub-Admins to view ALL shop profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins view all shops'
  ) THEN
    CREATE POLICY "Admins view all shops"
    ON public.shop_profiles
    FOR SELECT
    USING (
      exists (
        select 1 from public.users
        where id = auth.uid()
        and role in ('admin', 'sub-admin')
      )
    );
  END IF;
END
$$;

-- Allow Admins and Sub-Admins to update ALL shop profiles (for approval/rejections)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins update all shops'
  ) THEN
    CREATE POLICY "Admins update all shops"
    ON public.shop_profiles
    FOR UPDATE
    USING (
      exists (
        select 1 from public.users
        where id = auth.uid()
        and role in ('admin', 'sub-admin')
      )
    );
  END IF;
END
$$;
