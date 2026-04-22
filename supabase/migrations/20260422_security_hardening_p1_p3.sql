-- ============================================================================
-- SECURITY HARDENING — P1 to P3 FIXES
-- Date: 2026-04-22
-- Covers: 
--   - WARN-01 to WARN-21 (search_path injection)
--   - WARN-22 to WARN-23 (public bucket allows listing)
--   - INFO-01 (shop_pricing_logs no policy)
-- ============================================================================

-- ============================================================================
-- P1 FIX — WARN-01 to WARN-21: Function Search Path Mutable
-- Secures all SECURITY DEFINER functions by setting search_path = ''
-- to prevent search path injection attacks. 
-- Applied dynamically to the audited function names.
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT
            p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND p.proname IN (
              'deduct_wallet_balance',
              'protect_shop_pricing_updates',
              'auto_update_shop_pricing_on_platform_cost',
              'get_profit_summary',
              'get_profit_timeseries',
              'get_shop_owner_stats',
              'get_wallet_overview',
              'process_afa_order',
              'adjust_shop_pricing_for_role_change',
              'update_conversation_last_message',
              'get_admin_dashboard_stats',
              'get_user_dashboard_stats',
              'delete_shop_data',
              'protect_shop_admin_columns',
              'handle_new_user',
              'handle_new_user_wallet',
              'enforce_single_default_payment',
              'get_user_transactions_with_balance',
              'get_shop_orders_by_phone',
              'enforce_max_payment_details',
              'sync_shop_order_status_from_orders'
          )
    LOOP
        EXECUTE 'ALTER FUNCTION ' || func_record.func_signature || ' SET search_path = ''''';
    END LOOP;
END;
$$;

-- ============================================================================
-- P2 FIX — WARN-22 & WARN-23: Public Bucket Allows Listing
-- Removes broad SELECT policies that allowed directory listing of public buckets.
-- Direct URL access remains functional.
-- ============================================================================

-- Remove redundant listing policies from shop-banners
DROP POLICY IF EXISTS "Anyone can view banners" ON storage.objects;
DROP POLICY IF EXISTS "Shop Banners Public Read" ON storage.objects;

-- Remove redundant listing policy from shop-logos
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;

-- ============================================================================
-- P3 FIX — INFO-01: RLS Enabled No Policy for shop_pricing_logs
-- Adds read access policy for admins so the data is actually accessible.
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view shop pricing logs" ON public.shop_pricing_logs;
CREATE POLICY "Admins can view shop pricing logs"
ON public.shop_pricing_logs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'sub-admin')
));
