BEGIN;

-- 1. Revert Wallet Balances (Remove all profit credited so far)
-- We calculate the total profit per wallet and subtract it
WITH profit_summary AS (
  SELECT shop_wallet_id, SUM(amount) as total_profit
  FROM shop_wallet_transactions
  WHERE type = 'profit'
  GROUP BY shop_wallet_id
)
UPDATE shop_wallets sw
SET 
  balance = sw.balance - ps.total_profit,
  total_earned = sw.total_earned - ps.total_profit,
  updated_at = NOW()
FROM profit_summary ps
WHERE sw.id = ps.shop_wallet_id;

-- 2. Delete the Profit Transactions
-- This allows them to be re-credited correctly later (idempotency check won't block)
DELETE FROM shop_wallet_transactions WHERE type = 'profit';

-- 3. Fix the Cost Price & Profit on existing Shop Orders
-- (Switch from Admin Cost to Shop Cost/Price)
UPDATE shop_orders so
SET 
  cost_price = dp.price,
  profit = so.selling_price - dp.price
FROM data_packages dp
WHERE so.package_id = dp.id;

COMMIT;
