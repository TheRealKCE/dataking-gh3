-- Migration: Add CodeCraft fulfillment tracking columns to shop_orders
-- Adds two columns:
--   codecraft_reference_id: stores CodeCraft's returned reference_id after successful placement
--   fulfilled_by: stamps which supplier handled the order ('codecraft' | 'datakazina')

ALTER TABLE public.shop_orders
ADD COLUMN IF NOT EXISTS codecraft_reference_id text,
ADD COLUMN IF NOT EXISTS fulfilled_by text;

-- Optional: index fulfilled_by for admin dashboard queries filtering by supplier
CREATE INDEX IF NOT EXISTS idx_shop_orders_fulfilled_by ON public.shop_orders (fulfilled_by);
