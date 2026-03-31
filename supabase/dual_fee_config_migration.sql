-- ============================================================
-- Migration: Dual Customer/Agent Fee Configuration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add new role-specific global settings keys
-- These new keys drive per-role fee resolution.
-- The old singular keys remain as passive fallbacks.
INSERT INTO public.shop_global_settings (key, value, updated_at) VALUES
  ('withdrawal_fee_percent_customer', '5.0',  NOW()),
  ('withdrawal_fee_percent_agent',    '3.0',  NOW()),
  ('withdrawal_fee_flat_customer',    '0.0',  NOW()),
  ('withdrawal_fee_flat_agent',       '0.0',  NOW()),
  ('shop_paystack_fee_percent_customer', '1.95', NOW()),
  ('shop_paystack_fee_percent_agent',    '1.50', NOW()),
  ('min_withdrawal_amount_customer',  '50.0', NOW()),
  ('min_withdrawal_amount_agent',     '30.0', NOW())
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. Security Trigger: Protect admin-only columns on shop_profiles
-- Prevents authenticated shop owners from using the Supabase client
-- directly to manipulate their own fee overrides.
-- Service role (server-side APIs) bypasses this trigger safely.
-- ============================================================

CREATE OR REPLACE FUNCTION protect_shop_admin_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce restriction for standard authenticated users (shop owners).
  -- Server-side calls using the service role bypass RLS entirely and
  -- are NOT subject to this trigger guard (auth.role() will be null or 'service_role').
  IF auth.role() = 'authenticated' THEN
    -- Force sensitive admin-only columns to remain unchanged
    NEW.paystack_fee_percent      := OLD.paystack_fee_percent;
    NEW.withdrawal_fee_percent    := OLD.withdrawal_fee_percent;
    NEW.withdrawal_fee_flat       := OLD.withdrawal_fee_flat;
    NEW.min_withdrawal_amount     := OLD.min_withdrawal_amount;
    NEW.approval_status           := OLD.approval_status;
    NEW.fulfillment_mode          := OLD.fulfillment_mode;
    NEW.is_active                 := OLD.is_active;
    NEW.approved_by               := OLD.approved_by;
    NEW.approved_at               := OLD.approved_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists to allow re-running this migration
DROP TRIGGER IF EXISTS enforce_shop_admin_columns ON public.shop_profiles;

CREATE TRIGGER enforce_shop_admin_columns
BEFORE UPDATE ON public.shop_profiles
FOR EACH ROW EXECUTE FUNCTION protect_shop_admin_columns();
