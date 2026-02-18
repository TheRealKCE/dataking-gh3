-- Migration: Add shop_name to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_name TEXT;

-- Create index for easier filtering
CREATE INDEX IF NOT EXISTS idx_orders_shop_name ON public.orders(shop_name) WHERE shop_name IS NOT NULL;
