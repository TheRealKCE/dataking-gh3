-- ============================================================================
-- SECURITY HARDENING — P4 FIXES (Trigger Functions)
-- Date: 2026-04-22
-- Covers: Search Path Injection warnings on non-SECURITY DEFINER trigger functions
-- ============================================================================

ALTER FUNCTION public.update_conversation_last_message() SET search_path = '';
ALTER FUNCTION public.enforce_single_default_payment() SET search_path = '';
ALTER FUNCTION public.enforce_max_payment_details() SET search_path = '';
