-- Migration: Add owner_role_at_time and admin_cost_at_time to shop_orders
-- These columns are needed by the shop order processor to record the shop
-- owner's role and admin cost at the time of purchase for audit/reporting purposes.

ALTER TABLE shop_orders
    ADD COLUMN IF NOT EXISTS owner_role_at_time TEXT,
    ADD COLUMN IF NOT EXISTS admin_cost_at_time NUMERIC(10, 2);
