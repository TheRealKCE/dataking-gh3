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
    p_network        TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_note TEXT;
    v_new_note     TEXT;
BEGIN
    -- Get the current admin note
    SELECT admin_note INTO v_current_note
    FROM public.shop_wallet_transactions
    WHERE id = p_transaction_id
      AND status = 'rejected'
      AND shop_wallet_id IN (
          SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid()
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resubmission failed: transaction not found, not rejected, or does not belong to you.';
    END IF;

    -- Build the hardcoded audit trail note server-side
    v_new_note := '[RESUBMITTED] Previously rejected: "' || COALESCE(v_current_note, 'No reason given') || '". New payment details provided.';

    -- Perform the extremely restricted update
    UPDATE public.shop_wallet_transactions
    SET
        status       = 'pending',
        account_name = p_account_name,
        momo_number  = p_momo_number,
        network      = p_network,
        admin_note   = v_new_note,
        updated_at   = NOW()
    WHERE id = p_transaction_id;
END;
$$;

-- Grant execute to authenticated users only (not anon)
REVOKE ALL ON FUNCTION public.resubmit_withdrawal(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resubmit_withdrawal(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
