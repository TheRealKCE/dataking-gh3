-- Kuntanii supplier (MTN only): DB objects the integration references.
-- Apply this BEFORE deploying the code.

-- 1. The externalOrderId we sent to Kuntanii (orders.id / shop_orders.id, or
--    "<id>-rN" after a cancelled attempt was replaced). It is the key their status
--    endpoint takes and the first thing their webhook carries.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kuntanii_reference TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS kuntanii_reference TEXT;

-- 2. Allow 'kuntanii' as a fulfillment_method on orders. Without it the stamp is
--    shed, and the sync cron (which filters on fulfillment_method='kuntanii')
--    never sees the order.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_method_check
  CHECK (fulfillment_method IN ('auto', 'manual', 'codecraft', 'datakazina', 'kingflexy', 'eazydata', 'agentportal', 'netpulse', 'hendylinks', 'bundleportal', 'kuntanii'));

-- 3. Partial indexes for the sync cron's filtered scans.
CREATE INDEX IF NOT EXISTS idx_orders_kuntanii_processing
  ON orders (fulfillment_method, status)
  WHERE fulfillment_method = 'kuntanii' AND status = 'processing';

CREATE INDEX IF NOT EXISTS idx_shop_orders_kuntanii_processing
  ON shop_orders (fulfilled_by, status)
  WHERE fulfilled_by = 'kuntanii' AND status = 'processing';

-- 4. The webhook looks an order up by the externalOrderId first.
CREATE INDEX IF NOT EXISTS idx_orders_kuntanii_reference
  ON orders (kuntanii_reference)
  WHERE kuntanii_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_orders_kuntanii_reference
  ON shop_orders (kuntanii_reference)
  WHERE kuntanii_reference IS NOT NULL;
