ALTER TABLE orders ADD COLUMN IF NOT EXISTS kingflexy_reference TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS kingflexy_reference TEXT;
