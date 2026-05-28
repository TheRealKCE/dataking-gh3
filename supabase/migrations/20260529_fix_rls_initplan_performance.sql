-- ============================================================================
-- MIGRATION: Fix RLS Auth Init-Plan Performance
-- Date: 2026-05-29
-- Fixes: auth_rls_initplan WARN across 25 tables (35+ policies)
--
-- Problem: Calling auth.uid() / auth.role() directly in USING / WITH CHECK
--          forces Postgres to re-evaluate the function for every scanned row,
--          producing O(n) auth calls instead of O(1).
--
-- Fix:    Wrap every auth call in a (SELECT ...) subquery so the planner treats
--         it as an InitPlan — evaluated once and cached for the whole statement.
--
--         auth.uid()   →  (SELECT auth.uid())
--         auth.role()  →  (SELECT auth.role())
--
-- This is a pure performance change: semantics are identical.
-- ============================================================================

-- ── users ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile"         ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"       ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- ── wallets ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;

CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── wallet_transactions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view own transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── wallet_payments ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own payments" ON public.wallet_payments;

CREATE POLICY "Users can view own payments"
  ON public.wallet_payments FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── orders ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders"   ON public.orders;

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── notifications ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── complaints ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can create complaints"   ON public.complaints;

CREATE POLICY "Users can view own complaints"
  ON public.complaints FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create complaints"
  ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── customer_purchases ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own customer purchases" ON public.customer_purchases;

CREATE POLICY "Users can view own customer purchases"
  ON public.customer_purchases FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── afa_orders ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own AFA orders" ON public.afa_orders;
DROP POLICY IF EXISTS "Users can create AFA orders"   ON public.afa_orders;

CREATE POLICY "Users can view own AFA orders"
  ON public.afa_orders FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create AFA orders"
  ON public.afa_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── airtime_orders ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own airtime orders"  ON public.airtime_orders;
DROP POLICY IF EXISTS "Users can create airtime orders"    ON public.airtime_orders;
DROP POLICY IF EXISTS "Admins can view all airtime orders" ON public.airtime_orders;
DROP POLICY IF EXISTS "Admins can update airtime orders"   ON public.airtime_orders;

CREATE POLICY "Users can view own airtime orders"
  ON public.airtime_orders FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create airtime orders"
  ON public.airtime_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all airtime orders"
  ON public.airtime_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

CREATE POLICY "Admins can update airtime orders"
  ON public.airtime_orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── system_announcements ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access" ON public.system_announcements;

CREATE POLICY "Admin full access"
  ON public.system_announcements FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── phone_blacklist ─────────────────────────────────────────────────────────────
-- Drop all known variants — the linter flagged two name variants
DROP POLICY IF EXISTS "Admin full access to phone_blacklist" ON public.phone_blacklist;
DROP POLICY IF EXISTS "Admin full access to phone blacklist" ON public.phone_blacklist;
DROP POLICY IF EXISTS "phone_blacklist_admin_only"           ON public.phone_blacklist;

CREATE POLICY "phone_blacklist_admin_only"
  ON public.phone_blacklist FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── mtn_fulfillment_tracking ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access to mtn fulfillment tracking" ON public.mtn_fulfillment_tracking;

CREATE POLICY "Admin full access to mtn fulfillment tracking"
  ON public.mtn_fulfillment_tracking FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── fulfillment_logs ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access to fulfillment logs" ON public.fulfillment_logs;

CREATE POLICY "Admin full access to fulfillment logs"
  ON public.fulfillment_logs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── admin_settings ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin modify access to admin settings" ON public.admin_settings;

CREATE POLICY "Admin modify access to admin settings"
  ON public.admin_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── pending_settlements ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin only access" ON public.pending_settlements;

CREATE POLICY "Admin only access"
  ON public.pending_settlements FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── download_batches ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage download_batches" ON public.download_batches;

CREATE POLICY "Admins can manage download_batches"
  ON public.download_batches FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin', 'sub_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin', 'sub_admin')
    )
  );

-- ── shop_orders ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "shop_orders_shop_owner_read" ON public.shop_orders;
DROP POLICY IF EXISTS "shop_orders_admin_read"      ON public.shop_orders;

CREATE POLICY "shop_orders_shop_owner_read"
  ON public.shop_orders FOR SELECT TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM public.shop_profiles
      WHERE owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "shop_orders_admin_read"
  ON public.shop_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── shop_wallets ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners can update their own shop wallet" ON public.shop_wallets;

CREATE POLICY "Owners can update their own shop wallet"
  ON public.shop_wallets FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- ── shop_wallet_transactions ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "shop_wallet_transactions_owner_read"          ON public.shop_wallet_transactions;
DROP POLICY IF EXISTS "admin_all_shop_transactions"                   ON public.shop_wallet_transactions;
DROP POLICY IF EXISTS "Owners can insert their own shop transactions" ON public.shop_wallet_transactions;

CREATE POLICY "shop_wallet_transactions_owner_read"
  ON public.shop_wallet_transactions FOR SELECT TO authenticated
  USING (
    shop_wallet_id IN (
      SELECT id FROM public.shop_wallets WHERE owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "admin_all_shop_transactions"
  ON public.shop_wallet_transactions FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) IN ('admin', 'subadmin', 'sub-admin')
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) IN ('admin', 'subadmin', 'sub-admin')
  );

CREATE POLICY "Owners can insert their own shop transactions"
  ON public.shop_wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (
    shop_wallet_id IN (
      SELECT id FROM public.shop_wallets WHERE owner_id = (SELECT auth.uid())
    )
  );

-- ── shop_announcements ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "shop_announcements_owner_all" ON public.shop_announcements;

CREATE POLICY "shop_announcements_owner_all"
  ON public.shop_announcements FOR ALL TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM public.shop_profiles WHERE owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM public.shop_profiles WHERE owner_id = (SELECT auth.uid())
    )
  );

-- ── shop_global_settings ────────────────────────────────────────────────────────
-- "shop_global_settings_read" uses auth.uid() for authenticated-user check.
-- "shop_global_settings_admin_write" references auth.uid() in the EXISTS clause.
DROP POLICY IF EXISTS "shop_global_settings_read"        ON public.shop_global_settings;
DROP POLICY IF EXISTS "shop_global_settings_admin_write" ON public.shop_global_settings;

CREATE POLICY "shop_global_settings_read"
  ON public.shop_global_settings FOR SELECT TO authenticated
  USING ((SELECT auth.role()) = 'authenticated');

CREATE POLICY "shop_global_settings_admin_write"
  ON public.shop_global_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ── results_checker_types ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rc_types_admin_insert" ON public.results_checker_types;
DROP POLICY IF EXISTS "rc_types_admin_update" ON public.results_checker_types;
DROP POLICY IF EXISTS "rc_types_admin_delete" ON public.results_checker_types;
DROP POLICY IF EXISTS "rc_types_write_admin"  ON public.results_checker_types;

CREATE POLICY "rc_types_admin_insert"
  ON public.results_checker_types FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

CREATE POLICY "rc_types_admin_update"
  ON public.results_checker_types FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

CREATE POLICY "rc_types_admin_delete"
  ON public.results_checker_types FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── results_checker_inventory ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "rc_inventory_admin_only"   ON public.results_checker_inventory;
DROP POLICY IF EXISTS "rc_inventory_admin_select" ON public.results_checker_inventory;
DROP POLICY IF EXISTS "rc_inventory_admin_insert" ON public.results_checker_inventory;
DROP POLICY IF EXISTS "rc_inventory_admin_update" ON public.results_checker_inventory;
DROP POLICY IF EXISTS "rc_inventory_admin_delete" ON public.results_checker_inventory;

CREATE POLICY "rc_inventory_admin_select"
  ON public.results_checker_inventory FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

CREATE POLICY "rc_inventory_admin_insert"
  ON public.results_checker_inventory FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

CREATE POLICY "rc_inventory_admin_update"
  ON public.results_checker_inventory FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

CREATE POLICY "rc_inventory_admin_delete"
  ON public.results_checker_inventory FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

-- ── results_checker_orders ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rc_orders_admin_all"    ON public.results_checker_orders;
DROP POLICY IF EXISTS "rc_orders_user_select"  ON public.results_checker_orders;
DROP POLICY IF EXISTS "rc_orders_admin_insert" ON public.results_checker_orders;
DROP POLICY IF EXISTS "rc_orders_admin_update" ON public.results_checker_orders;

CREATE POLICY "rc_orders_user_select"
  ON public.results_checker_orders FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT auth.role()) = 'service_role'
  );

CREATE POLICY "rc_orders_admin_insert"
  ON public.results_checker_orders FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );

CREATE POLICY "rc_orders_admin_update"
  ON public.results_checker_orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
