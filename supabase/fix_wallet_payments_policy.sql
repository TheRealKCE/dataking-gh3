-- ============================================================================
-- FIX: Add RLS Policies to wallet_payments Table
-- Fixes INFO suggestion: RLS Enabled No Policy
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Wallet Payments Table Policies
-- This table likely stores Paystack payment records
-- Users should see their own payments, admins can see all
-- ----------------------------------------------------------------------------

-- Drop any existing policies (clean start)
DROP POLICY IF EXISTS "Users can view own wallet payments" ON public.wallet_payments;
DROP POLICY IF EXISTS "Admins can view all wallet payments" ON public.wallet_payments;

-- Users can view their own payment records
CREATE POLICY "Users can view own wallet payments"
ON public.wallet_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wallets
    WHERE wallets.id = wallet_payments.wallet_id
    AND wallets.user_id = auth.uid()
  )
);

-- Admins can view all payment records
CREATE POLICY "Admins can view all wallet payments"
ON public.wallet_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
);

-- System/API can insert payment records (via service role key)
-- No policy needed for INSERT as it will be done server-side with service role

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check policies exist
SELECT 
    tablename,
    policyname,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'wallet_payments'
ORDER BY policyname;

-- Expected result: 2 policies (one for users, one for admins)

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
