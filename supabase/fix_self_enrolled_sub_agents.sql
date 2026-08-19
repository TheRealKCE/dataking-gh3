-- ============================================================================
-- Cleanup: Leads who were enrolled as sub-agents of their OWN shop
-- ----------------------------------------------------------------------------
-- How they got there: the Lead opened their own /join invite link to test it and
-- signed up with their own email + phone. The signup route happily attached a
-- sub_agents row to their existing account, which then:
--   * flipped their whole dashboard to the de-branded sub portal
--     (app/dashboard/layout.tsx renders SubPortalShell for any sub-agent), and
--   * made "My Shop" in that portal show their EXISTING storefront — so every
--     recruit they handed the phone to believed a shop had already been created
--     for them and could never create their own.
--
-- The signup route now refuses this (OWN_SHOP_ERROR in
-- app/api/shop/sub-agents/signup/route.ts), so this only clears the rows that
-- were created before the fix.
--
-- Only rows that never became real sub-agents are removed: status 'pending' and
-- never approved. An approved row is left alone for a human to look at.
--
-- Run in the Supabase SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- Look first.
SELECT sa.id, sa.status, sa.created_at, u.email, s.shop_name
FROM public.sub_agents sa
JOIN public.shop_profiles s ON s.id = sa.upline_shop_id AND s.owner_id = sa.user_id
JOIN public.users u ON u.id = sa.user_id
ORDER BY sa.created_at;

-- Then delete.
DELETE FROM public.sub_agents sa
USING public.shop_profiles s
WHERE s.id = sa.upline_shop_id
  AND s.owner_id = sa.user_id      -- the "sub-agent" owns the shop they joined
  AND sa.status = 'pending'
  AND sa.approved_at IS NULL;
