-- Migration: Classifieds Marketplace Schema
-- Date: 2026-07-01

-- 1. Add seller capabilities to users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_seller') THEN
        ALTER TABLE public.users ADD COLUMN is_seller BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'seller_verified_at') THEN
        ALTER TABLE public.users ADD COLUMN seller_verified_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Create categories table
CREATE TABLE IF NOT EXISTS public.classified_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icon_emoji VARCHAR(50),
    parent_id UUID REFERENCES public.classified_categories(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create listings table (core classifieds table)
CREATE TABLE IF NOT EXISTS public.classified_listings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES public.classified_categories(id) ON DELETE RESTRICT,
    price DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'archived')),
    location VARCHAR(255),
    condition VARCHAR(50) DEFAULT 'used' CHECK (condition IN ('new', 'like-new', 'used', 'refurbished')),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 4. Create listing_images table
CREATE TABLE IF NOT EXISTS public.classified_listing_images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    storage_path VARCHAR(500) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create contact_reveals table (track when buyers reveal contact info)
CREATE TABLE IF NOT EXISTS public.classified_contact_reveals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    revealed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_safety_tips_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(listing_id, buyer_id)
);

-- 6. Create favorites table
CREATE TABLE IF NOT EXISTS public.classified_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_classifieds_listings_seller_id ON public.classified_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_listings_category_id ON public.classified_listings(category_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_listings_status ON public.classified_listings(status);
CREATE INDEX IF NOT EXISTS idx_classifieds_listings_created_at ON public.classified_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classifieds_listings_status_created ON public.classified_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classifieds_listings_location ON public.classified_listings(location);

CREATE INDEX IF NOT EXISTS idx_classifieds_listing_images_listing_id ON public.classified_listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_contact_reveals_listing_id ON public.classified_contact_reveals(listing_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_contact_reveals_buyer_id ON public.classified_contact_reveals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_favorites_user_id ON public.classified_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_favorites_listing_id ON public.classified_favorites(listing_id);

-- 8. Enable RLS on all tables
ALTER TABLE public.classified_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_contact_reveals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classified_favorites ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies - Categories (public read)
DROP POLICY IF EXISTS "Categories are publicly readable" ON public.classified_categories;
CREATE POLICY "Categories are publicly readable"
    ON public.classified_categories FOR SELECT
    USING (true);

-- 10. RLS Policies - Listings (public read active listings)
DROP POLICY IF EXISTS "Active listings are publicly readable" ON public.classified_listings;
CREATE POLICY "Active listings are publicly readable"
    ON public.classified_listings FOR SELECT
    USING (status = 'active' OR (seller_id = auth.uid()));

DROP POLICY IF EXISTS "Sellers can manage their own listings" ON public.classified_listings;
CREATE POLICY "Sellers can manage their own listings"
    ON public.classified_listings FOR ALL
    TO authenticated
    USING (seller_id = auth.uid())
    WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all listings" ON public.classified_listings;
CREATE POLICY "Admins can view all listings"
    ON public.classified_listings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('admin', 'sub-admin')
        )
    );

-- 11. RLS Policies - Listing Images (public read for active listings)
DROP POLICY IF EXISTS "Images for active listings are public" ON public.classified_listing_images;
CREATE POLICY "Images for active listings are public"
    ON public.classified_listing_images FOR SELECT
    USING (
        listing_id IN (
            SELECT id FROM public.classified_listings
            WHERE status = 'active' OR seller_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Sellers can manage their listing images" ON public.classified_listing_images;
CREATE POLICY "Sellers can manage their listing images"
    ON public.classified_listing_images FOR ALL
    TO authenticated
    USING (
        listing_id IN (
            SELECT id FROM public.classified_listings
            WHERE seller_id = auth.uid()
        )
    )
    WITH CHECK (
        listing_id IN (
            SELECT id FROM public.classified_listings
            WHERE seller_id = auth.uid()
        )
    );

-- 12. RLS Policies - Contact Reveals (authenticated only)
DROP POLICY IF EXISTS "Buyers can view their own reveals" ON public.classified_contact_reveals;
CREATE POLICY "Buyers can view their own reveals"
    ON public.classified_contact_reveals FOR SELECT
    TO authenticated
    USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can view reveals on their listings" ON public.classified_contact_reveals;
CREATE POLICY "Sellers can view reveals on their listings"
    ON public.classified_contact_reveals FOR SELECT
    TO authenticated
    USING (
        listing_id IN (
            SELECT id FROM public.classified_listings
            WHERE seller_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Buyers can create contact reveals" ON public.classified_contact_reveals;
CREATE POLICY "Buyers can create contact reveals"
    ON public.classified_contact_reveals FOR INSERT
    TO authenticated
    WITH CHECK (buyer_id = auth.uid());

-- 13. RLS Policies - Favorites (authenticated only)
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.classified_favorites;
CREATE POLICY "Users can manage their own favorites"
    ON public.classified_favorites FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 14. Permissions
GRANT SELECT ON public.classified_categories TO anon, authenticated;
GRANT ALL ON public.classified_categories TO service_role;

GRANT SELECT ON public.classified_listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.classified_listings TO authenticated;
GRANT ALL ON public.classified_listings TO service_role;

GRANT SELECT ON public.classified_listing_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.classified_listing_images TO authenticated;
GRANT ALL ON public.classified_listing_images TO service_role;

GRANT SELECT, INSERT ON public.classified_contact_reveals TO authenticated;
GRANT ALL ON public.classified_contact_reveals TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classified_favorites TO authenticated;
GRANT ALL ON public.classified_favorites TO service_role;
