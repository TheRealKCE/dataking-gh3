-- Fix: Grant EXECUTE on shop order tracking RPC to public roles
-- Without this, anonymous (unauthenticated) users on the storefront status page
-- get an RPC permission error when searching for their orders.
-- The function is SECURITY DEFINER so it runs with admin privileges;
-- we just need to allow anon/authenticated to call it.

GRANT EXECUTE ON FUNCTION public.get_shop_orders_by_phone(text, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shop_orders_by_phone(text, int) TO authenticated;
