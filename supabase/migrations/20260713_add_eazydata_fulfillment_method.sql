-- EazyData supplier: DB objects the integration referenced in code but never added.

-- 1. Columns to store EazyData's returned order reference on both order tables.
--    The purchase / refulfill paths write these and the status-sync cron reads
--    them; without the columns those writes fail and orders can't be synced.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eazydata_reference TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS eazydata_reference TEXT;

-- 2. Allow 'eazydata' as a fulfillment_method on orders.
--    Without this, stamping fulfillment_method='eazydata' violates the CHECK
--    constraint and silently falls back to leaving the method as 'auto'. The
--    EazyData status-sync cron filters orders on fulfillment_method='eazydata',
--    so those orders are never picked up and stay stuck in 'processing' forever.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_method_check
  CHECK (fulfillment_method IN ('auto', 'manual', 'codecraft', 'datakazina', 'kingflexy', 'eazydata'));
