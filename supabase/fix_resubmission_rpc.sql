-- ============================================================
-- Fix: Secure RPC for Shop Owner Withdrawal Resubmission
-- RUN THIS AS A **NEW QUERY** in Supabase SQL Editor
-- ============================================================
-- Why: Shop owners do not have RLS UPDATE permission on 
-- shop_wallet_transactions (unsafe). This function runs with 
-- elevated DB privileges (SECURITY DEFINER) but strictly 
-- limits what can be changed — payment details only.
-- Amount, fee, net_amount, and balance_snapshot are LOCKED.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resubmit_withdrawal(
    p_transaction_id UUID,
    p_account_name   TEXT,
    p_momo_number    TEXT,
    p_network        TEXT,
    p_admin_note     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.shop_wallet_transactions
    SET
        status       = 'pending',
        account_name = p_account_name,
        momo_number  = p_momo_number,
        network      = p_network,
        admin_note   = p_admin_note,
        updated_at   = NOW()
    WHERE id = p_transaction_id
      -- Must currently be rejected
      AND status = 'rejected'
      -- Must actually belong to the calling user
      AND shop_wallet_id IN (
          SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid()
      );

    -- If no row was updated, raise an error so the client knows
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resubmission failed: transaction not found, not rejected, or does not belong to you.';
    END IF;
END;
$$;

-- Grant execute to authenticated users only (not anon)
REVOKE ALL ON FUNCTION public.resubmit_withdrawal(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resubmit_withdrawal(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
