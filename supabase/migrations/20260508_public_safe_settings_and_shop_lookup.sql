-- Security fixes 2026-05-08:
-- 1. Expose only approved public admin settings through a narrow view.
-- 2. Replace phone-only guest shop order lookup with phone + Paystack reference lookup.
--
-- Important: this migration intentionally does NOT drop the open admin_settings
-- read policy. Per deployment gate, that destructive restriction must happen only
-- after the application has been deployed and verified against public_admin_settings.

create or replace view public.public_admin_settings as
select key, value
from public.admin_settings
where key in (
  'guest_storefront_url',
  'whatsapp_group_link',
  'whatsapp_channel_link',
  'whatsapp_admin_number',
  'whatsapp_community_link',
  'support_email',
  'footer_copyright_text',
  'footer_branding_text',
  'announcement_enabled',
  'announcement_title',
  'announcement_message',
  'agent_upgrade_price_3d',
  'agent_upgrade_price_14d',
  'agent_upgrade_price_30d',
  'agent_upgrade_price_permanent',
  'agent_upgrade_price_3d_old',
  'agent_upgrade_price_14d_old',
  'agent_upgrade_price_30d_old',
  'agent_upgrade_price_permanent_old',
  'show_price_strikethrough',
  'page_access_dashboard',
  'page_access_data_packages',
  'page_access_orders',
  'page_access_wallet',
  'page_access_complaints',
  'page_access_notifications',
  'page_access_profile',
  'page_access_shop',
  'page_access_storefront',
  'page_access_airtime',
  'storefront_airtime_enabled',
  'airtime_fee_mtn_customer',
  'airtime_fee_mtn_agent',
  'airtime_fee_telecel_customer',
  'airtime_fee_telecel_agent',
  'airtime_fee_at_customer',
  'airtime_fee_at_agent',
  'airtime_min_amount',
  'airtime_max_amount',
  'airtime_enabled_mtn',
  'airtime_enabled_telecel',
  'airtime_enabled_at'
);

grant select on public.public_admin_settings to anon, authenticated;

comment on view public.public_admin_settings is
  'Public-safe allowlist of admin_settings keys consumed by /api/public/config. whatsapp_admin_number is intentionally public for customer support escalation.';

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
    so.created_at,
    sp.shop_name,
    sp.shop_slug
  from public.shop_orders so
  join public.shop_profiles sp on so.shop_id = sp.id
  where so.guest_phone = phone_number
    and so.paystack_reference = order_reference
    and so.created_at >= now() - interval '48 hours'
  order by so.created_at desc
  limit 1;
end;
$$;

grant execute on function public.get_shop_order_by_phone_reference(text, text) to anon, authenticated;

revoke execute on function public.get_shop_orders_by_phone(text, int) from anon, authenticated;

