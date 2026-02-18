-- ============================================================
-- Robust Admin Permissions Fix (Security Definer Approach)
-- Run this in your Supabase SQL Editor to fix invisible shops
-- ============================================================

-- 1. Create a secure function to check admin status (Bypasses RLS)
-- This prevents infinite recursion loops when policies query the users table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER -- Runs with privileges of the creator (postgres), bypassing RLS
SET search_path = public -- Secure search path
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'sub-admin')
  );
$$;

-- 2. Update Shop Profiles Policies
-- Drop old potentially recursive policies if they exist
DROP POLICY IF EXISTS "Admins view all shops" ON public.shop_profiles;
DROP POLICY IF EXISTS "Admins update all shops" ON public.shop_profiles;

-- Create new robust policies using the function
CREATE POLICY "Admins view all shops"
ON public.shop_profiles
FOR SELECT
USING ( public.is_admin() );

CREATE POLICY "Admins update all shops"
ON public.shop_profiles
FOR UPDATE
USING ( public.is_admin() );

-- 3. Update Users Table Policies (Crucial for the Join to work)
-- Admins need to see the owner details (name, email) of the shops
-- If this was missing, the join would fail or return incomplete data

-- Enable RLS on users just in case (usually already on)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Admins view all users'
  ) THEN
    CREATE POLICY "Admins view all users"
    ON public.users
    FOR SELECT
    USING ( public.is_admin() );
  END IF;
END
$$;

-- 4. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- 5. Force refresh of schema cache (optional but helpful)
NOTIFY pgrst, 'reload schema';
