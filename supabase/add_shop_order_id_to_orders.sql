-- Migration: Add shop_order_id to orders table for robust syncing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_order_id UUID REFERENCES public.shop_orders(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_shop_order_id ON public.orders(shop_order_id) WHERE shop_order_id IS NOT NULL;
