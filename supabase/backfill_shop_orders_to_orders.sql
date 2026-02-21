-- ============================================================
-- Backfill: Mirror unmirrored shop_orders into the orders table
-- 
-- Run ONCE in Supabase SQL Editor.
-- Safe to run multiple times (NOT EXISTS guard).
-- ============================================================

-- Step 0: Relax user_id constraint to allow Guest Shop Orders (NULL user_id)
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- Optional preview: uncomment to see what will be inserted first
-- SELECT
--     so.id AS shop_order_id,
--     sp.shop_name,
--     so.guest_phone,
--     so.network,
--     so.package_size,
--     so.selling_price,
--     so.status,
--     so.created_at
-- FROM public.shop_orders so
-- JOIN public.shop_profiles sp ON sp.id = so.shop_id
-- WHERE NOT EXISTS (
--     SELECT 1 FROM public.orders o WHERE o.shop_order_id = so.id
-- )
-- ORDER BY so.created_at DESC;

-- Insert missing mirror rows into orders
INSERT INTO public.orders (
    user_id,
    phone_number,
    network,
    size,
    price,
    cost_price,
    status,
    payment_status,
    reference_code,
    fulfillment_method,
    shop_name,
    shop_order_id,
    created_at,
    updated_at
)
SELECT
    NULL AS user_id,                          -- guest purchase, no linked user
    so.guest_phone AS phone_number,
    so.network,
    so.package_size AS size,
    so.selling_price AS price,
    so.cost_price,
    so.status,                                -- preserve the original status
    'paid' AS payment_status,                 -- payment was verified via Paystack
    CASE
        WHEN so.paystack_reference IS NOT NULL
        THEN 'SHOP-' || RIGHT(so.paystack_reference, 10)
        ELSE 'SHOP-BF-' || LEFT(so.id::text, 8)
    END AS reference_code,
    'auto' AS fulfillment_method,
    sp.shop_name,
    so.id AS shop_order_id,
    so.created_at,
    so.updated_at
FROM public.shop_orders so
JOIN public.shop_profiles sp ON sp.id = so.shop_id
-- Only insert rows that don't already have a mirror row
WHERE NOT EXISTS (
    SELECT 1 FROM public.orders o WHERE o.shop_order_id = so.id
)
-- Only backfill paid orders (excludes abandoned unpaid sessions)
AND so.status IN ('pending', 'processing', 'completed', 'refunded');

-- Confirm: show the mirrored rows just inserted
SELECT
    o.id,
    o.shop_name,
    o.phone_number,
    o.network,
    o.size,
    o.status,
    o.created_at
FROM public.orders o
WHERE o.shop_order_id IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 20;
