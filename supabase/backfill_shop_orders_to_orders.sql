-- ============================================================
-- Backfill: Mirror unmirrored shop_orders into the orders table
-- 
-- Run this in Supabase SQL Editor.
-- Safe to re-run:
-- 1. Inserts missing mirrors
-- 2. Updates existing mirrors to link to shop owner (fixes N/A purchaser)
-- ============================================================

-- Step 0: Ensure user_id can be NULL (for safety, though we are now linking to owner)
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- Step 1: BACKFILL (Insert missing mirrors)
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
    sp.owner_id AS user_id,                   -- Link to shop owner for admin visibility
    so.guest_phone AS phone_number,
    so.network,
    so.package_size AS size,
    so.selling_price AS price,
    so.cost_price,
    so.status,
    'paid' AS payment_status,
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
WHERE NOT EXISTS (
    SELECT 1 FROM public.orders o WHERE o.shop_order_id = so.id
)
AND so.status IN ('pending', 'processing', 'completed', 'refunded');

-- Step 2: UPDATE (Fix existing mirrored orders that have NULL user_id)
UPDATE public.orders o
SET user_id = sp.owner_id
FROM public.shop_orders so
JOIN public.shop_profiles sp ON sp.id = so.shop_id
WHERE o.shop_order_id = so.id
  AND o.user_id IS NULL;

-- Confirm Results
SELECT
    o.id,
    o.shop_name,
    u.first_name || ' ' || u.last_name as purchaser_name,
    u.role as purchaser_role,
    o.phone_number as beneficiary,
    o.status,
    o.created_at
FROM public.orders o
JOIN public.users u ON u.id = o.user_id
WHERE o.shop_order_id IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 10;
