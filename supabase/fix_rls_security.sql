-- ============================================================================
-- SUPABASE SECURITY FIX
-- Fix for 4 RLS errors detected by Security Advisor
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Row Level Security on all 4 tables
-- ============================================================================

ALTER TABLE public.mtn_fulfillment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_blacklist ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create RLS Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- MTN Fulfillment Tracking Policies
-- This table tracks MTN order fulfillment status
-- Only admins should have access to this data
-- ----------------------------------------------------------------------------

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin full access to mtn fulfillment tracking" ON public.mtn_fulfillment_tracking;

-- Admins can do everything
CREATE POLICY "Admin full access to mtn fulfillment tracking"
ON public.mtn_fulfillment_tracking
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
);

-- ----------------------------------------------------------------------------
-- Fulfillment Logs Policies
-- System and admin logs for debugging and monitoring
-- Only admins should have access
-- ----------------------------------------------------------------------------

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin full access to fulfillment logs" ON public.fulfillment_logs;

-- Admins can do everything
CREATE POLICY "Admin full access to fulfillment logs"
ON public.fulfillment_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
);

-- ----------------------------------------------------------------------------
-- Admin Settings Policies
-- Application-wide admin settings
-- Only admins should have access
-- ----------------------------------------------------------------------------

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin full access to admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admin read access to admin settings" ON public.admin_settings;

-- Only admins can read settings
CREATE POLICY "Admin read access to admin settings"
ON public.admin_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
);

-- Only full admins can modify settings (not sub-admins)
CREATE POLICY "Admin modify access to admin settings"
ON public.admin_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- ----------------------------------------------------------------------------
-- Phone Blacklist Policies
-- List of blocked phone numbers
-- Admins can manage, system can check
-- ----------------------------------------------------------------------------

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin full access to phone blacklist" ON public.phone_blacklist;
DROP POLICY IF EXISTS "Authenticated users can check blacklist" ON public.phone_blacklist;

-- Admins can do everything
CREATE POLICY "Admin full access to phone blacklist"
ON public.phone_blacklist
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
);

-- Authenticated users can only check if a number is blacklisted (read-only)
-- This allows the system to validate phone numbers during signup/order
CREATE POLICY "Authenticated users can check blacklist"
ON public.phone_blacklist
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- STEP 3: Verification Queries
-- Run these to verify the fixes are applied correctly
-- ============================================================================

-- Check RLS is enabled on all 4 tables
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'mtn_fulfillment_tracking',
    'fulfillment_logs',
    'admin_settings',
    'phone_blacklist'
)
ORDER BY tablename;

-- Expected result: All should show rls_enabled = true

-- Check policies exist on all 4 tables
SELECT 
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN roles = '{authenticated}' THEN 'authenticated'
        ELSE array_to_string(roles, ', ')
    END as applies_to
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'mtn_fulfillment_tracking',
    'fulfillment_logs',
    'admin_settings',
    'phone_blacklist'
)
ORDER BY tablename, policyname;

-- Check for any remaining tables without RLS
SELECT 
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
ORDER BY tablename;

-- If this returns any rows, those tables also need RLS enabled!

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. After running this script, the 4 security errors should be resolved
-- 2. Check Security Advisor again in 24 hours to confirm
-- 3. If you have other tables, make sure they also have RLS enabled
-- 4. Test your application to ensure all features still work correctly

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
