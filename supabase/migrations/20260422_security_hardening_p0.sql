-- ============================================================================
-- SECURITY HARDENING — P0 CRITICAL FIXES
-- Date: 2026-04-22
-- Covers: DEEP-01 (credit_wallet_balance unguarded) + ERROR-01 (afa_registrations SECURITY DEFINER view)
-- ============================================================================

-- ============================================================================
-- P0 FIX 1 — DEEP-01: Guard credit_wallet_balance against unauthorized calls
-- Without this guard, ANY authenticated user can call this RPC to credit
-- any wallet with any amount — an infinite money exploit.
-- Fix: Require service_role JWT claim. Uses canonical Supabase claims parsing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.credit_wallet_balance(
  p_user_id uuid,
  p_amount  numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jwt_role TEXT;
BEGIN
  -- SECURITY: Only callable by server-side service role.
  -- Uses canonical Supabase JWT claims JSON (not legacy dot-notation which can return NULL).
  v_jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    ''
  );

  IF v_jwt_role != 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: credit_wallet_balance requires service_role';
  END IF;

  -- Guard: reject zero or negative amounts
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: amount must be positive';
  END IF;

  UPDATE public.wallets
  SET
    balance     = balance + p_amount,
    total_spent = GREATEST(0, COALESCE(total_spent, 0) - p_amount),
    updated_at  = now()
  WHERE user_id = p_user_id;
END;
$$;

-- ============================================================================
-- P0 FIX 2 — ERROR-01: afa_registrations SECURITY DEFINER view
-- This view runs as the view creator (superuser), completely bypassing RLS.
-- Fix: Drop and recreate with security_invoker = true so the querying user's
-- own RLS policies apply. The underlying tables have their own RLS policies
-- so data access is still correctly scoped.
-- ============================================================================

-- Step 1: Capture the existing view definition before dropping
-- (The recreation below uses the exact columns from the existing view)

DROP VIEW IF EXISTS public.afa_registrations;

-- Step 2: Recreate with security_invoker (default, RLS-respecting behaviour)
CREATE OR REPLACE VIEW public.afa_registrations
WITH (security_invoker = true)
AS
SELECT
  ao.id,
  ao.user_id,
  ao.full_name,
  ao.phone,
  ao.ghana_card,
  ao.id_type,
  ao.id_number,
  ao.location,
  ao.region,
  ao.occupation,
  ao.date_of_birth,
  ao.notes,
  ao.status,
  ao.payment_amount,
  ao.reference_code,
  ao.transaction_id,
  ao.created_at,
  u.email        AS user_email,
  u.first_name   AS user_first_name,
  u.last_name    AS user_last_name,
  u.phone_number AS user_phone
FROM public.afa_orders ao
LEFT JOIN public.users u ON u.id = ao.user_id;

-- Restore SELECT grant for authenticated users (admins access via RLS on afa_orders)
GRANT SELECT ON public.afa_registrations TO authenticated;
