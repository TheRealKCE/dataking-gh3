-- ============================================================================
-- Backfill: make existing sub-agent storefronts mirror their parent (upline)
-- ----------------------------------------------------------------------------
-- New sub shops are seeded + approved in code (app/api/shop/profile/route.ts),
-- but shops created before that fix are stuck at pricing_status='not_submitted'
-- with an empty catalog, so their storefront shows "Under Review".
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- 1. Seed each sub shop's catalog from its parent's prices (0 starting margin),
--    but only for sub shops that don't have any pricing yet.
INSERT INTO public.shop_pricing (shop_id, package_id, selling_price, profit_margin)
SELECT s.id, pp.package_id, pp.selling_price, 0
FROM public.shop_profiles s
JOIN public.sub_agents  sa ON sa.user_id  = s.owner_id
JOIN public.shop_pricing pp ON pp.shop_id = sa.upline_shop_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.shop_pricing x WHERE x.shop_id = s.id
)
ON CONFLICT DO NOTHING;

-- 2. Approve pricing on every sub-owned shop so the storefront goes live
--    (sub prices are already bounded by the parent — no admin review needed).
UPDATE public.shop_profiles s
SET pricing_status = 'approved'
FROM public.sub_agents sa
WHERE sa.user_id = s.owner_id
  AND s.pricing_status IS DISTINCT FROM 'approved';

-- 3. Mirror the parent's airtime fees, but only where the sub hasn't set any
--    (all three still 0/NULL) — never clobber a sub who customised their fees.
UPDATE public.shop_profiles s
SET airtime_fee_mtn     = COALESCE(p.airtime_fee_mtn, 0),
    airtime_fee_telecel = COALESCE(p.airtime_fee_telecel, 0),
    airtime_fee_at      = COALESCE(p.airtime_fee_at, 0)
FROM public.sub_agents sa
JOIN public.shop_profiles p ON p.id = sa.upline_shop_id
WHERE s.owner_id = sa.user_id
  AND COALESCE(s.airtime_fee_mtn, 0)     = 0
  AND COALESCE(s.airtime_fee_telecel, 0) = 0
  AND COALESCE(s.airtime_fee_at, 0)      = 0;
