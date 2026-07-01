-- Migration: Classifieds Listing Boosts / Promotion System
-- Date: 2026-07-02

-- 1. Add boost columns to classified_listings
ALTER TABLE public.classified_listings
  ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS boost_tier VARCHAR(10);

-- 2. Create classified_boosts table (audit/history)
CREATE TABLE IF NOT EXISTS public.classified_boosts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tier VARCHAR(10) NOT NULL,
    amount_paid DECIMAL(12, 2) NOT NULL,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_classifieds_boosts_listing_id ON public.classified_boosts(listing_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_boosts_seller_id ON public.classified_boosts(seller_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_listings_is_boosted ON public.classified_listings(is_boosted, boosted_until DESC);

-- 4. Enable RLS on boosts table
ALTER TABLE public.classified_boosts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - Boosts
DROP POLICY IF EXISTS "Sellers see own boosts" ON public.classified_boosts;
CREATE POLICY "Sellers see own boosts"
    ON public.classified_boosts FOR SELECT
    TO authenticated
    USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "Admins see all boosts" ON public.classified_boosts;
CREATE POLICY "Admins see all boosts"
    ON public.classified_boosts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('admin', 'sub-admin')
        )
    );

DROP POLICY IF EXISTS "Sellers can create boosts for own listings" ON public.classified_boosts;
CREATE POLICY "Sellers can create boosts for own listings"
    ON public.classified_boosts FOR INSERT
    TO authenticated
    WITH CHECK (
        seller_id = auth.uid()
        AND listing_id IN (
            SELECT id FROM public.classified_listings
            WHERE seller_id = auth.uid()
        )
    );

-- 6. Permissions
GRANT SELECT ON public.classified_boosts TO anon, authenticated;
GRANT INSERT ON public.classified_boosts TO authenticated;
GRANT ALL ON public.classified_boosts TO service_role;
