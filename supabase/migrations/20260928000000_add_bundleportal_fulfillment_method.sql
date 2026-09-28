-- BundlePortal supplier: DB objects the integration references.

-- 1. Columns to store BundlePortal's own reference (e.g. "KT-88213") returned by
--    place_order. Unlike HendyLinks this is NOT the only correlation key:
--    BundlePortal echoes the order_id we send (our orders.id, or shop_orders.id
--    on the storefront path) in both the webhook and get_transactions.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundleportal_reference TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS bundleportal_reference TEXT;

-- 2. Allow 'bundleportal' as a fulfillment_method on orders.
--    Without this, stamping fulfillment_method='bundleportal' violates the CHECK
--    constraint. The dispatcher falls back to writing the order WITHOUT
--    fulfillment_method, and the reconciliation cron (which filters on
--    fulfillment_method='bundleportal') then never sees it. Apply this BEFORE
--    deploying the code.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_method_check
  CHECK (fulfillment_method IN ('auto', 'manual', 'codecraft', 'datakazina', 'kingflexy', 'eazydata', 'agentportal', 'netpulse', 'hendylinks', 'bundleportal'));

-- 3. Partial indexes so the reconciliation cron's filtered scans stay cheap.
CREATE INDEX IF NOT EXISTS idx_orders_bundleportal_processing
  ON orders (fulfillment_method, status)
  WHERE fulfillment_method = 'bundleportal' AND status = 'processing';

CREATE INDEX IF NOT EXISTS idx_shop_orders_bundleportal_processing
  ON shop_orders (fulfilled_by, status)
  WHERE fulfilled_by = 'bundleportal' AND status = 'processing';

-- 4. The webhook looks an order up by BundlePortal's reference first.
CREATE INDEX IF NOT EXISTS idx_orders_bundleportal_reference
  ON orders (bundleportal_reference)
  WHERE bundleportal_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_orders_bundleportal_reference
  ON shop_orders (bundleportal_reference)
  WHERE bundleportal_reference IS NOT NULL;
