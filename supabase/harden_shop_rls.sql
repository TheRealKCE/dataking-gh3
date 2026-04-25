-- Hardening Shop Wallet Transactions RLS
-- Ensures shop owners can only see their 'withdrawal' records.
-- 'profit' credits are restricted to administrators to isolate administrative data.

DROP POLICY IF EXISTS "shop_wallet_transactions_owner_read" ON public.shop_wallet_transactions;

CREATE POLICY "shop_wallet_transactions_owner_read" ON public.shop_wallet_transactions
FOR SELECT 
TO authenticated 
USING (
    shop_wallet_id IN (SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid())
    AND (
        type = 'withdrawal'
        OR (
            SELECT role FROM public.users WHERE id = auth.uid()
        ) IN ('admin', 'subadmin')
    )
);

-- Ensure admins can see ALL transactions regardless of wallet ownership (if needed)
-- Actually, the above policy allows admins to see any transaction if they own a wallet, 
-- but we usually want a separate bypass policy for admins to see everything.

DROP POLICY IF EXISTS "admin_all_shop_transactions" ON public.shop_wallet_transactions;
CREATE POLICY "admin_all_shop_transactions" ON public.shop_wallet_transactions
FOR ALL
TO authenticated
USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'subadmin')
)
WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'subadmin')
);
