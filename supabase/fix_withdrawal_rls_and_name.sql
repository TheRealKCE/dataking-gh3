-- 1. Add account_name column to shop_wallet_transactions
ALTER TABLE public.shop_wallet_transactions 
ADD COLUMN IF NOT EXISTS account_name TEXT;

-- 2. Fixed RLS for Shop Wallets (Owners need to deduct balance during withdrawal)
-- Drop existing owner read policy if we want to be clean, but adding UPDATE is the priority
CREATE POLICY "Owners can update their own shop wallet"
ON public.shop_wallets
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- 3. Fixed RLS for Shop Wallet Transactions (Owners need to insert withdrawal requests)
-- Allow shop owners to insert their own transactions
CREATE POLICY "Owners can insert their own shop transactions"
ON public.shop_wallet_transactions
FOR INSERT
WITH CHECK (
    shop_wallet_id IN (
        SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid()
    )
);

-- 4. Enable RLS on shop_wallet_transactions if not already active (it should be)
ALTER TABLE public.shop_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Ensure admins can still do everything (they have policies from previous script, but good to check)
-- This script assumes public.is_admin() exists and works as intended from previous migrations.
