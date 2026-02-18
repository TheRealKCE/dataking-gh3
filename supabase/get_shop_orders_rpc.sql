-- Secure RPC to fetch shop orders for guests (bypasses RLS)
-- This function allows anyone to fetch orders if they know the phone number.
-- It returns orders + basic shop details.

create or replace function get_shop_orders_by_phone(
  phone_number text,
  limit_count int default 20
)
returns table (
  id uuid,
  network text,
  package_size text,
  selling_price numeric,
  status text,
  created_at timestamptz,
  guest_phone text,
  shop_name text,
  shop_slug text
)
language plpgsql
security definer -- ✨ Runs with admin privileges to bypass RLS
as $$
begin
  return query
  select 
    so.id,
    so.network,
    so.package_size,
    so.selling_price,
    so.status,
    so.created_at,
    so.guest_phone,
    sp.shop_name,
    sp.shop_slug
  from shop_orders so
  join shop_profiles sp on so.shop_id = sp.id
  where so.guest_phone = phone_number
  order by so.created_at desc
  limit limit_count;
end;
$$;
