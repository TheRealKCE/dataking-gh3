-- Migration: Add Eazy Data supplier support
-- Run this in Supabase SQL editor

-- 1. Add eazydata_reference column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eazydata_reference TEXT;

-- 2. Add eazydata_reference column to shop_orders table
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS eazydata_reference TEXT;

-- 3. Extend fulfillment_method CHECK constraint to include 'eazydata'
--    (Drop the old constraint first, then re-add it with the new value)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_method_check
    CHECK (fulfillment_method IN ('auto', 'manual', 'codecraft', 'kingflexy', 'eazydata', 'datakazina'));

-- 4. (Optional) Add index for faster cron job queries
CREATE INDEX IF NOT EXISTS idx_orders_eazydata_reference ON orders (eazydata_reference) WHERE eazydata_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_orders_eazydata_reference ON shop_orders (eazydata_reference) WHERE eazydata_reference IS NOT NULL;
