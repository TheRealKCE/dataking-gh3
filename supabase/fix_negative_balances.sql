-- Fix Negative Balances
-- The revert script subtracted all historical profit. If a shop had made withdrawals, 
-- this correctly (but inconveniently) resulted in a negative balance (Debt).
-- This script forgives that "debt" by resetting any negative balance to 0.

BEGIN;

-- 1. Reset Negative Current Balances to 0
UPDATE public.shop_wallets
SET balance = 0, updated_at = NOW()
WHERE balance < 0;

-- 2. Reset Negative Total Earned to 0 (Just in case)
UPDATE public.shop_wallets
SET total_earned = 0, updated_at = NOW()
WHERE total_earned < 0;

COMMIT;
