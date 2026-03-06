-- BACKFILL: Calculate and populate balance_snapshot for historical transactions
-- This script reconstructs the wallet balance history by working backwards
-- from the current wallet balance.

DO $$
DECLARE
    wallet_record RECORD;
    trans_record RECORD;
    current_calc_balance NUMERIC;
BEGIN
    -- Loop through each wallet
    FOR wallet_record IN SELECT id, balance FROM shop_wallets LOOP
        current_calc_balance := wallet_record.balance;

        -- Loop through ALL transactions for this wallet in reverse chronological order
        FOR trans_record IN 
            SELECT id, type, amount, status 
            FROM shop_wallet_transactions 
            WHERE shop_wallet_id = wallet_record.id
            ORDER BY created_at DESC, id DESC
        LOOP
            -- If it's a withdrawal and it was PENDING or COMPLETED, 
            -- it means it WAS deducted from the balance.
            -- To go BACKWARDS in time, we RE-ADD the amount if it was a deduction (withdrawal)
            -- or SUBTRACT it if it was an addition (profit).
            
            -- IMPORTANT: We only care about transactions that actually affected the balance.
            -- Current logic: 
            -- - Withdrawals (Pending/Completed/Rejected) have been deducted.
            -- - Profit (Completed) have been added.

            IF trans_record.type = 'withdrawal' THEN
                -- If the status is NOT rejected (meaning it stayed deducted) 
                -- OR if it's already rejected but the money wasn't restored yet (old logic)
                -- we add it back to find previous state.
                current_calc_balance := current_calc_balance + trans_record.amount;
                
                -- Update the snapshot for this withdrawal
                -- (Note: current_calc_balance here is the balance AFTER the deduction occurred)
                -- Wait, the snapshot should be the balance REMAINING after the request.
                -- So if current balance is 100 and last trans was -20 withdrawal, 
                -- previous balance was 120. Snapshot for that -20 is 100.
                UPDATE shop_wallet_transactions 
                SET balance_snapshot = (current_calc_balance - trans_record.amount)
                WHERE id = trans_record.id;
                
            ELSIF trans_record.type = 'profit' AND trans_record.status = 'completed' THEN
                -- Subtract profit to go backwards
                current_calc_balance := current_calc_balance - trans_record.amount;
            END IF;
        END LOOP;
    END FOR;
END $$;
