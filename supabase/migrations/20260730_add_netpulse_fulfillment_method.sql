-- NetPulse supplier: DB objects the integration references.

-- 1. Columns to store the NetPulse order reference (e.g. "NPAPI-1234-abc") returned
--    by POST /api/v1/purchase. NetPulse has no webhook, so the status-sync cron
--    reads these and polls GET /api/v1/order-status/{reference} to close orders out.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS netpulse_reference TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS netpulse_reference TEXT;

-- 2. Allow 'netpulse' as a fulfillment_method on orders.
--    Without this, stamping fulfillment_method='netpulse' violates the CHECK
--    constraint and the order can't be picked up by the netpulse status-sync
--    cron (which filters on fulfillment_method='netpulse').
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_method_check
  CHECK (fulfillment_method IN ('auto', 'manual', 'codecraft', 'datakazina', 'kingflexy', 'eazydata', 'agentportal', 'netpulse'));

-- 3. Partial indexes so the status-sync cron's filtered scans stay cheap.
CREATE INDEX IF NOT EXISTS idx_orders_netpulse_processing
  ON orders (fulfillment_method, status)
  WHERE fulfillment_method = 'netpulse' AND status = 'processing';

CREATE INDEX IF NOT EXISTS idx_shop_orders_netpulse_processing
  ON shop_orders (fulfilled_by, status)
  WHERE fulfilled_by = 'netpulse' AND status = 'processing';
