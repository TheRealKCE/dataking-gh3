-- Migration: Public-safe seller profile view for classifieds
-- Date: 2026-07-06
--
-- Why: The classifieds listing pages query with the ANON key and embed
--   users(seller_verified_at) to render the "Verified" badge (and the seller
--   name on the detail page). RLS on public.users only allows a user to read
--   their OWN row ("Users can view own profile" -> id = auth.uid()), so the
--   embed always resolved to NULL for the seller and the badge never appeared.
--
-- Fix: expose ONLY non-sensitive seller fields (name + verification timestamp)
--   through a narrow view, mirroring public.public_admin_settings. This view
--   deliberately EXCLUDES email, phone_number, role, and status. A default
--   (security_invoker = false) view runs with the owner's privileges, so it can
--   surface these safe columns without opening public.users itself to anon.

CREATE OR REPLACE VIEW public.classified_sellers_public AS
SELECT
  id,
  first_name,
  last_name,
  seller_verified_at
FROM public.users
WHERE is_seller = true;

GRANT SELECT ON public.classified_sellers_public TO anon, authenticated;

COMMENT ON VIEW public.classified_sellers_public IS
  'Public-safe subset of users (name + seller verification only) for classifieds seller display. Excludes email/phone/role/status. Embedded by anon listing queries as users:classified_sellers_public. Restricted to is_seller = true.';
