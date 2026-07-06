-- Marketplace Seller Profiles
-- Lazy-created when user first sells/contacts a buyer
-- Tracks seller identity, region, verification, and rating

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_seller_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '',
    region TEXT,
    city TEXT,
    whatsapp_number TEXT,
    verification_tier TEXT DEFAULT 'none' CHECK (verification_tier IN ('none', 'phone', 'id', 'pro')),
    rating_avg NUMERIC(3,2) DEFAULT 0.0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
    rating_count INTEGER DEFAULT 0,
    response_time_hours INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketplace_seller_profiles ENABLE ROW LEVEL SECURITY;

-- Public read on verified sellers
CREATE POLICY "Public read verified sellers" ON marketplace_seller_profiles
    FOR SELECT USING (is_verified = TRUE);

-- Seller read own profile
CREATE POLICY "Seller read own profile" ON marketplace_seller_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Seller update own profile
CREATE POLICY "Seller update own profile" ON marketplace_seller_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Admin read all
CREATE POLICY "Admin read all profiles" ON marketplace_seller_profiles
    FOR SELECT USING (
        EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'sub-admin'))
    );

-- Indexes
CREATE INDEX idx_marketplace_seller_profiles_region ON marketplace_seller_profiles(region);
CREATE INDEX idx_marketplace_seller_profiles_city ON marketplace_seller_profiles(city);
CREATE INDEX idx_marketplace_seller_profiles_verified ON marketplace_seller_profiles(is_verified);
CREATE INDEX idx_marketplace_seller_profiles_created_at ON marketplace_seller_profiles(created_at DESC);

COMMIT;
