-- ============================================================================
-- SUPABASE SECURITY WARNINGS FIX
-- Fix for 3 warnings detected by Security Advisor
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- WARNINGS TO FIX:
-- 1. handle_new_user() - Function Search Path Mutable
-- 2. handle_new_user_wallet() - Function Search Path Mutable  
-- 3. Leaked Password Protection (must be enabled in dashboard)
-- ============================================================================

-- ============================================================================
-- FIX 1 & 2: Add search_path to functions
-- This prevents SQL injection attacks via search_path manipulation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Fix handle_new_user() function
-- This function creates user profile when new auth user is created
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, phone_number, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    -- Extract metadata if available, otherwise default to empty strings
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    'customer',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- The wallet trigger will handle the wallet creation separately
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Fix handle_new_user_wallet() function
-- This function auto-creates wallet when new user is created
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- Run these to verify the fixes are applied correctly
-- ============================================================================

-- Check that search_path is now set on both functions
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN p.proconfig IS NULL THEN 'NO search_path set ⚠️'
        WHEN 'search_path=' = ANY(p.proconfig) THEN 'search_path set to empty ✅'
        ELSE array_to_string(p.proconfig, ', ') 
    END as configuration
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('handle_new_user', 'handle_new_user_wallet')
ORDER BY p.proname;

-- Expected result: Both functions should show "search_path set to empty ✅"

-- ============================================================================
-- FIX 3: Enable Leaked Password Protection
-- This MUST be done in Supabase Dashboard (cannot be done via SQL)
-- ============================================================================

-- MANUAL STEPS (DO IN SUPABASE DASHBOARD):
-- 
-- 1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/auth/rate-limits
-- 2. Scroll down to "Password Requirements" section
-- 3. Find "Leaked password protection"
-- 4. Toggle ON the switch to enable
-- 5. Click "Save"
-- 
-- This will check passwords against HaveIBeenPwned.org database to prevent
-- users from using compromised passwords.

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. The search_path = '' setting prevents SQL injection via search_path
-- 2. With empty search_path, you must use fully qualified names (public.users)
-- 3. Both functions already use qualified names, so no code changes needed
-- 4. Leaked password protection is a dashboard setting only
-- 5. After enabling, test signup to ensure it works

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
