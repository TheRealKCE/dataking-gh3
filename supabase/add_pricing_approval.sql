-- ============================================================
-- Two-Stage Pricing Approval Migration (Safe Re-run Version)
-- ============================================================

-- 1. Add columns (IF NOT EXISTS handles already-added columns)
ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_status TEXT DEFAULT 'not_submitted';

ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_note TEXT;

ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_rejection_acknowledged BOOLEAN DEFAULT true;

ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_submitted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_approved_by UUID REFERENCES public.users(id);

-- 2. Add CHECK constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shop_profiles_pricing_status_check'
  ) THEN
    ALTER TABLE public.shop_profiles
      ADD CONSTRAINT shop_profiles_pricing_status_check
      CHECK (pricing_status IN ('not_submitted', 'pending_review', 'approved', 'rejected'));
  END IF;
END $$;

-- 3. Create pending pricing table
CREATE TABLE IF NOT EXISTS public.shop_pricing_pending (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES public.data_packages(id) ON DELETE CASCADE NOT NULL,
  selling_price DECIMAL(12, 2) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, package_id)
);

-- 4. Enable RLS
ALTER TABLE public.shop_pricing_pending ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shop_pricing_pending' AND policyname = 'shop_pricing_pending_owner'
  ) THEN
    CREATE POLICY "shop_pricing_pending_owner" ON public.shop_pricing_pending
      FOR ALL USING (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shop_pricing_pending' AND policyname = 'shop_pricing_pending_admin'
  ) THEN
    CREATE POLICY "shop_pricing_pending_admin" ON public.shop_pricing_pending
      FOR ALL USING (public.is_admin());
  END IF;
END $$;

-- 6. Update public read policies
DROP POLICY IF EXISTS "shop_profiles_public_read" ON public.shop_profiles;
CREATE POLICY "shop_profiles_public_read" ON public.shop_profiles
  FOR SELECT USING (
    approval_status = 'approved'
    AND pricing_status = 'approved'
    AND is_active = true
  );

DROP POLICY IF EXISTS "shop_pricing_public_read" ON public.shop_pricing;
CREATE POLICY "shop_pricing_public_read" ON public.shop_pricing
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM public.shop_profiles
      WHERE approval_status = 'approved'
        AND pricing_status = 'approved'
        AND is_active = true
    )
  );

-- 7. Refresh schema cache
NOTIFY pgrst, 'reload schema';
