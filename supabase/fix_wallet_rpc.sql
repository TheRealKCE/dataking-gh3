-- Re-create the function to fix balance mismatch issues
-- This version derives the historical balance by starting from the CURRENT actual balance
-- and working backwards, ensuring "New Balance" always matches the user's wallet state.

-- First, drop the existing function to allow return type changes
DROP FUNCTION IF EXISTS public.get_user_transactions_with_balance(uuid,integer,integer,text,text,timestamp with time zone,timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_user_transactions_with_balance(
    p_user_id UUID,
    p_limit INTEGER,
    p_offset INTEGER,
    p_source_filter TEXT DEFAULT 'all',
    p_type_filter TEXT DEFAULT 'all',
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    amount DECIMAL,
    type TEXT,
    description TEXT,
    reference TEXT,
    source TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    balance_before DECIMAL,
    balance_after DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL;
BEGIN
    -- 1. Get current wallet balance
    SELECT balance INTO v_current_balance
    FROM public.wallets
    WHERE user_id = p_user_id;
    
    -- Default to 0 if no wallet found
    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;

    RETURN QUERY
    SELECT 
        t.id,
        t.amount,
        t.type,
        t.description,
        t.reference,
        t.source,
        t.status,
        t.created_at,
        -- Calculate Balance Before
        (
            v_current_balance - 
            -- Net change of ALL transactions that happened AFTER this one
            COALESCE((
                SELECT SUM(
                    CASE WHEN t2.type = 'credit' THEN t2.amount ELSE -t2.amount END
                )
                FROM public.wallet_transactions t2
                WHERE t2.user_id = p_user_id
                AND (t2.created_at > t.created_at OR (t2.created_at = t.created_at AND t2.id > t.id))
            ), 0)
            -- Subtract THIS transaction's effect to get "Before" state
            - (CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END)
        )::DECIMAL as balance_before,

        -- Calculate Balance After
        (
            v_current_balance - 
            -- Net change of ALL transactions that happened AFTER this one
            COALESCE((
                SELECT SUM(
                    CASE WHEN t2.type = 'credit' THEN t2.amount ELSE -t2.amount END
                )
                FROM public.wallet_transactions t2
                WHERE t2.user_id = p_user_id
                AND (t2.created_at > t.created_at OR (t2.created_at = t.created_at AND t2.id > t.id))
            ), 0)
        )::DECIMAL as balance_after
    FROM public.wallet_transactions t
    WHERE t.user_id = p_user_id
    AND (p_source_filter = 'all' OR t.source = p_source_filter)
    AND (p_type_filter = 'all' OR t.type = p_type_filter)
    AND (p_start_date IS NULL OR t.created_at >= p_start_date)
    AND (p_end_date IS NULL OR t.created_at <= p_end_date)
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
