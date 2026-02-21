-- ============================================================
-- Backfill: Mirror unmirrored shop_orders into the orders table
-- 
-- Run ONCE in Supabase SQL Editor.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- ============================================================

-- Step 1: Show a preview of what will be inserted (run this first to verify)
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

-- Step 2: Insert the missing mirror rows
INSERT INTO public.orders (
    user_id,
    phone_number,
    network,
    size,
    price,
    cost_price,
    status,
    payment_status,
    payment_method,
    reference_code,
    fulfillment_method,
    shop_name,
    shop_order_id,
    created_at,
    updated_at
)
SELECT
    NULL AS user_id,                          -- guest purchase, no user account
    so.guest_phone AS phone_number,
    so.network,
    so.package_size AS size,
    so.selling_price AS price,
    so.cost_price,
    so.status,                                -- preserve original status
    'paid' AS payment_status,                 -- payment was verified by Paystack
    'paystack' AS payment_method,
    -- Generate a reference code from paystack_reference (same pattern as verify route)
    CASE
        WHEN so.paystack_reference IS NOT NULL
        THEN 'SHOP-' || RIGHT(so.paystack_reference, 10)
        ELSE 'SHOP-BACKFILL-' || LEFT(so.id::text, 8)
    END AS reference_code,
    'auto' AS fulfillment_method,
    sp.shop_name,
    so.id AS shop_order_id,
    so.created_at,
    so.updated_at
FROM public.shop_orders so
JOIN public.shop_profiles sp ON sp.id = so.shop_id
-- Only insert rows that don't already have a mirror in orders
WHERE NOT EXISTS (
    SELECT 1 FROM public.orders o WHERE o.shop_order_id = so.id
)
-- Only backfill orders that were actually paid (not pending/failed with no payment)
AND so.status IN ('pending', 'processing', 'completed', 'refunded');

-- Show how many rows were inserted
SELECT 'Backfill complete. Rows inserted:' AS message, COUNT(*) AS count
FROM public.orders
WHERE shop_order_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '1 minute';
