-- ============================================================================
-- Shop AFA Registration Pricing Migration
-- Created: 2026-08-19
--
-- Puts AFA registration on the public storefront as a shop-priced product.
-- Modelled on 20260522_shop_rc_pricing.sql — AFA is, like results checker
-- vouchers, a flat-priced non-data product sold to guests.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table: shop_afa_pricing
--    One row per shop. Unlike RC (many voucher types) AFA is a single product,
--    so shop_id carries the UNIQUE constraint directly.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_afa_pricing (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL UNIQUE REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
  selling_price DECIMAL(12,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_afa_pricing_shop ON public.shop_afa_pricing(shop_id);

-- ----------------------------------------------------------------------------
-- 2. Row-Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.shop_afa_pricing ENABLE ROW LEVEL SECURITY;

-- Shop owners can manage their own AFA pricing
DROP POLICY IF EXISTS "shop_afa_pricing_owner_all" ON public.shop_afa_pricing;
CREATE POLICY "shop_afa_pricing_owner_all" ON public.shop_afa_pricing
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = (SELECT auth.uid()))
  );

-- Public can read AFA pricing for live approved shops
DROP POLICY IF EXISTS "shop_afa_pricing_public_read" ON public.shop_afa_pricing;
CREATE POLICY "shop_afa_pricing_public_read" ON public.shop_afa_pricing
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM public.shop_profiles
      WHERE approval_status = 'approved' AND is_active = true
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Admin setting: global storefront AFA toggle (ships OFF)
-- ----------------------------------------------------------------------------
INSERT INTO public.admin_settings (key, value)
VALUES ('storefront_afa_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Extend afa_orders for guest / storefront orders
-- ----------------------------------------------------------------------------

-- Storefront applicants are guests with no account, so user_id must be optional.
-- The existing RLS ("Users can view own AFA orders": user_id = auth.uid()) simply
-- never matches a guest row, which is the behaviour we want.
ALTER TABLE public.afa_orders ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.afa_orders
  ADD COLUMN IF NOT EXISTS shop_id        UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shop_name      TEXT,
  ADD COLUMN IF NOT EXISTS shop_markup    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price     DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS source         TEXT DEFAULT 'dashboard',
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'completed';

-- Backfill before adding the CHECKs so existing rows (all wallet-paid from the
-- dashboard) cannot violate them.
UPDATE public.afa_orders SET source = 'dashboard' WHERE source IS NULL;
UPDATE public.afa_orders SET payment_status = 'completed' WHERE payment_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'afa_orders_source_check'
  ) THEN
    ALTER TABLE public.afa_orders
      ADD CONSTRAINT afa_orders_source_check
      CHECK (source IN ('dashboard', 'storefront'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'afa_orders_payment_status_check'
  ) THEN
    ALTER TABLE public.afa_orders
      ADD CONSTRAINT afa_orders_payment_status_check
      CHECK (payment_status IN ('pending_payment', 'completed', 'failed'));
  END IF;
END $$;

-- `status` is deliberately left alone. It drives the admin fulfilment workflow
-- (pending → processing → completed/cancelled); payment state lives in its own
-- column so an unpaid storefront checkout never enters the admin queue.
CREATE INDEX IF NOT EXISTS idx_afa_orders_shop ON public.afa_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_afa_orders_payment_status ON public.afa_orders(payment_status);

-- No INSERT policy is added: storefront orders are written with the service-role
-- client, which bypasses RLS.
