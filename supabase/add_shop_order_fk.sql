-- Migration to add missing foreign key constraint for shop_order_id

ALTER TABLE public.shop_wallet_transactions
ADD CONSTRAINT fk_shop_wallet_transactions_shop_order
FOREIGN KEY (shop_order_id)
REFERENCES public.shop_orders(id)
ON DELETE SET NULL;
