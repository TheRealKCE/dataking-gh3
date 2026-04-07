-- ============================================================================
-- MIGRATION: Fix RLS Vulnerabilities — shop_orders, phone_blacklist,
--            shop_global_settings
-- Date:      2026-04-06
-- Scorecard: Fix #7 (CRITICAL), #8 (HIGH), #9 (MEDIUM)
-- ============================================================================
-- IMPORTANT: Run this in the Supabase SQL Editor or via supabase db push.
-- This migration is ADDITIVE — it drops and recreates only the named policies.
-- All other existing policies (INSERT/UPDATE/etc.) are left untouched.
-- ============================================================================


-- ============================================================================
-- FIX 1 — shop_orders (CRITICAL)
-- Problem:  USING(true) policy gives every anon/authenticated user full SELECT
--           access to all orders, leaking guest phone numbers, order amounts,
--           shop IDs, payment references and fulfilment status for every order.
-- Fix:      Drop the open policy. Replace with three scoped read policies plus
--           a dedicated admin policy. Anon role loses all SELECT access.
--
-- Architecture note:
--   • The /shop/[slug]/success page uses createServerClient() (service role)
--     — it bypasses RLS and does NOT need an anon policy.
--   • The /shop/status tracker uses get_shop_orders_by_phone(), which is
--     SECURITY DEFINER — it also bypasses RLS and does NOT need an anon policy.
--   • shop_orders has NO user_id column (orders are guest-based); therefore
--     no "customer reads their own order" RLS policy is expressible. Access
--     for guests is delegated entirely to the SECURITY DEFINER RPC.
-- ============================================================================

-- 1a. Drop the vulnerable open-read policy
DROP POLICY IF EXISTS "shop_orders_public_read" ON public.shop_orders;

-- 1b. Shop owner can read all orders belonging to their shop(s)
--     (Replaces/refreshes the existing shop_orders_owner_read)
DROP POLICY IF EXISTS "shop_orders_owner_read"      ON public.shop_orders;
DROP POLICY IF EXISTS "shop_orders_shop_owner_read" ON public.shop_orders;

CREATE POLICY "shop_orders_shop_owner_read"
ON public.shop_orders
FOR SELECT
TO authenticated
USING (
  shop_id IN (
    SELECT id FROM public.shop_profiles
    WHERE owner_id = auth.uid()
  )
);

-- 1c. Admin and sub-admin can read ALL shop orders
DROP POLICY IF EXISTS "shop_orders_admin_read" ON public.shop_orders;

CREATE POLICY "shop_orders_admin_read"
ON public.shop_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'sub-admin')
  )
);

-- 1d. Ensure RLS is enabled (idempotent)
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

-- 1e. Revoke the overly broad table-level SELECT grant that was applied
--     in repair_shop_system.sql ("GRANT SELECT ON ALL TABLES TO anon").
--     We revoke granularly; other tables keep their grants.
REVOKE SELECT ON public.shop_orders FROM anon;


-- ============================================================================
-- FIX 2 — phone_blacklist (HIGH)
-- Problem:  "Authenticated users can check blacklist" policy lets every logged-in
--           user enumerate all blacklisted phone numbers — a privacy and
--           abuse-reconnaissance risk.
-- Fix:      Restrict ALL operations to admin and sub-admin only.
--           Regular users (customer, agent) get zero access.
-- ============================================================================

-- 2a. Drop the vulnerable policy (exact name as audited)
DROP POLICY IF EXISTS "Authenticated users can check blacklist" ON public.phone_blacklist;
-- Also drop any other pre-existing policies to start clean
DROP POLICY IF EXISTS "phone_blacklist_admin_only"  ON public.phone_blacklist;
DROP POLICY IF EXISTS "phone_blacklist_select"       ON public.phone_blacklist;
DROP POLICY IF EXISTS "phone_blacklist_all"          ON public.phone_blacklist;

-- 2b. Single admin-only policy covering all operations
CREATE POLICY "phone_blacklist_admin_only"
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

-- 2c. Ensure RLS is enabled
ALTER TABLE public.phone_blacklist ENABLE ROW LEVEL SECURITY;

-- 2d. Revoke any direct table-level grants to anon/authenticated
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.phone_blacklist FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.phone_blacklist FROM authenticated;
-- Re-grant only what RLS will enforce via the policy above
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_blacklist TO authenticated;


-- ============================================================================
-- FIX 3 — shop_global_settings (MEDIUM)
-- Problem:  "Anyone can view global settings" policy is name-only — unclear
--           if it also allows writes via lack of WITH CHECK. More critically,
--           if anon users can write to this table, platform-wide fee configs
--           (Paystack percentages, feature toggles) can be tampered with.
-- Schema:   key TEXT, value TEXT (no is_public column).
-- Decision: Keep anon + authenticated READ access (required: /api/shop/initialize
--           is called by unauthenticated guests and reads paystack fee settings
--           from this table). Restrict ALL writes to admin only.
-- ============================================================================

-- 3a. Drop all pre-existing policies on this table
DROP POLICY IF EXISTS "Anyone can view global settings"           ON public.shop_global_settings;
DROP POLICY IF EXISTS "shop_global_settings_public_read"         ON public.shop_global_settings;
DROP POLICY IF EXISTS "shop_global_settings_authenticated_read"  ON public.shop_global_settings;
DROP POLICY IF EXISTS "shop_global_settings_admin_write"         ON public.shop_global_settings;

-- 3b. Allow anon and authenticated to READ (required for guest checkout flow)
CREATE POLICY "shop_global_settings_public_read"
ON public.shop_global_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- 3c. Restrict all writes (INSERT, UPDATE, DELETE) to admin only
CREATE POLICY "shop_global_settings_admin_write"
ON public.shop_global_settings
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

-- 3d. Ensure RLS is enabled
ALTER TABLE public.shop_global_settings ENABLE ROW LEVEL SECURITY;
