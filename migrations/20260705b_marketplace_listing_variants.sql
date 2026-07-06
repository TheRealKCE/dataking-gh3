-- Marketplace Listing Variants
-- Allows listings to have multiple options (e.g., Color × Size)
-- Supports up to 2 variant axes per listing

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_listing_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    option1_name TEXT,
    option1_value TEXT,
    option2_name TEXT,
    option2_value TEXT,
    price_delta_pesewas INTEGER DEFAULT 0,
    quantity INTEGER,
    is_available BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketplace_listing_variants ENABLE ROW LEVEL SECURITY;

-- Public read on variants of approved listings
CREATE POLICY "Public read approved variants" ON marketplace_listing_variants
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM classified_listings
            WHERE id = listing_id AND status = 'active'
        )
    );

-- Seller manage own listing variants
CREATE POLICY "Seller manage variants" ON marketplace_listing_variants
    FOR ALL USING (
        EXISTS(
            SELECT 1 FROM classified_listings
            WHERE id = listing_id AND seller_id = auth.uid()
        )
    );

-- Admin read all
CREATE POLICY "Admin read all variants" ON marketplace_listing_variants
    FOR SELECT USING (
        EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'sub-admin'))
    );

-- Indexes
CREATE INDEX idx_marketplace_variants_listing_id ON marketplace_listing_variants(listing_id);
CREATE INDEX idx_marketplace_variants_available ON marketplace_listing_variants(is_available) WHERE is_available = TRUE;

COMMIT;
