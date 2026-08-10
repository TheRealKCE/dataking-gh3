-- Expose supplier_status to the guest order tracker.
--
-- A shop order held for review at the supplier shows as plain "Processing" to the
-- customer chasing it, because the hold lives on `supplier_status` of the mirrored
-- `orders` row and this function never returned it. Admins could see the
-- distinction and customers could not, which is exactly backwards for the person
-- actually waiting on the bundle.
--
-- Only the derived label changes; `status` remains the source of truth and the
-- rest of the signature is untouched, so existing callers keep working.

create or replace function public.get_shop_order_by_phone_reference(
  phone_number text,
  order_reference text
)
returns table (
  id uuid,
  network text,
  package_size text,
  selling_price numeric,
  status text,
  supplier_status text,
  created_at timestamptz,
  shop_name text,
  shop_slug text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    so.id,
    so.network,
    so.package_size,
    so.selling_price,
    so.status,
    -- LEFT JOIN: the mirrored row is created by fulfillment and may not exist yet
    -- for a just-placed order. A missing row must read as "no hold", not drop the
    -- order out of the customer's tracker entirely.
    o.supplier_status,
    so.created_at,
    sp.shop_name,
    sp.shop_slug
  from public.shop_orders so
  join public.shop_profiles sp on so.shop_id = sp.id
  left join public.orders o on o.shop_order_id = so.id
  where so.guest_phone = phone_number
    and so.paystack_reference = order_reference
    and so.created_at >= now() - interval '48 hours'
  order by so.created_at desc
  limit 1;
end;
$$;

grant execute on function public.get_shop_order_by_phone_reference(text, text) to anon, authenticated;
