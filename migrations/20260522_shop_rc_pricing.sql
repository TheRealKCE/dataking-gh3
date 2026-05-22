-- ============================================================================
-- Shop Results Checker Pricing Migration
-- Created: 2026-05-22
-- ============================================================================

-- 1. Table: shop_rc_pricing
--    Stores per-shop selling prices for each results_checker_types entry.
CREATE TABLE IF NOT EXISTS public.shop_rc_pricing (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
  rc_type_id    UUID NOT NULL REFERENCES public.results_checker_types(id) ON DELETE CASCADE,
  selling_price DECIMAL(12,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, rc_type_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_rc_pricing_shop ON public.shop_rc_pricing(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_rc_pricing_type ON public.shop_rc_pricing(rc_type_id);

-- 2. Row-Level Security
ALTER TABLE public.shop_rc_pricing ENABLE ROW LEVEL SECURITY;

-- Shop owners can manage their own RC pricing
DROP POLICY IF EXISTS "shop_rc_pricing_owner_all" ON public.shop_rc_pricing;
CREATE POLICY "shop_rc_pricing_owner_all" ON public.shop_rc_pricing
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
  );

-- Public can read RC pricing for live approved shops
DROP POLICY IF EXISTS "shop_rc_pricing_public_read" ON public.shop_rc_pricing;
CREATE POLICY "shop_rc_pricing_public_read" ON public.shop_rc_pricing
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM public.shop_profiles
      WHERE approval_status = 'approved' AND is_active = true
    )
  );

-- 3. Admin setting: allow admin to toggle RC on storefronts globally
INSERT INTO public.admin_settings (key, value)
VALUES ('storefront_rc_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
