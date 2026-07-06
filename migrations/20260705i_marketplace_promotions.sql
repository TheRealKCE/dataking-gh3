-- Marketplace Promotions System
-- Pricing config, purchase tracking, and audit logs

BEGIN;

-- Promotion tier pricing configuration
CREATE TABLE IF NOT EXISTS public.marketplace_promotion_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name text NOT NULL UNIQUE,
    tier_level integer NOT NULL UNIQUE,
    display_name text NOT NULL,
    description text,
    price_pesewas integer NOT NULL,
    duration_hours integer NOT NULL,
    search_boost_multiplier numeric(3, 2) NOT NULL DEFAULT 1.0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),

    CONSTRAINT valid_tier_level CHECK (tier_level BETWEEN 1 AND 4),
    CONSTRAINT positive_price CHECK (price_pesewas > 0),
    CONSTRAINT positive_duration CHECK (duration_hours > 0),
    CONSTRAINT valid_boost CHECK (search_boost_multiplier > 0)
);

-- Promotion purchases / transactions
CREATE TABLE IF NOT EXISTS public.marketplace_promotion_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id uuid NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    tier_id uuid NOT NULL REFERENCES public.marketplace_promotion_tiers(id),
    price_pesewas integer NOT NULL,
    status text NOT NULL DEFAULT 'active', -- active, expired, cancelled
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),

    CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'cancelled'))
);

-- Promotion audit log
CREATE TABLE IF NOT EXISTS public.marketplace_promotion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id uuid NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    tier_id uuid NOT NULL REFERENCES public.marketplace_promotion_tiers(id),
    action text NOT NULL, -- purchased, renewed, expired, cancelled
    amount_pesewas integer,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_purchases_user_id
    ON public.marketplace_promotion_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_purchases_listing_id
    ON public.marketplace_promotion_purchases(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_purchases_status
    ON public.marketplace_promotion_purchases(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_purchases_expires_at
    ON public.marketplace_promotion_purchases(expires_at);

CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_logs_user_id
    ON public.marketplace_promotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_logs_listing_id
    ON public.marketplace_promotion_logs(listing_id);

-- RLS Policies
ALTER TABLE public.marketplace_promotion_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_promotion_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_promotion_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can read active promotion tiers
CREATE POLICY "marketplace_promotion_tiers_public_read"
    ON public.marketplace_promotion_tiers
    FOR SELECT
    USING (is_active = true);

-- Only admins can update tiers
CREATE POLICY "marketplace_promotion_tiers_admin_write"
    ON public.marketplace_promotion_tiers
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'is_admin' = 'true');

-- Users can see their own promotion purchases
CREATE POLICY "marketplace_promotion_purchases_owner_read"
    ON public.marketplace_promotion_purchases
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- Users can insert their own purchases
CREATE POLICY "marketplace_promotion_purchases_owner_insert"
    ON public.marketplace_promotion_purchases
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Only admins can update purchases
CREATE POLICY "marketplace_promotion_purchases_admin_write"
    ON public.marketplace_promotion_purchases
    FOR UPDATE
    USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'is_admin' = 'true');

-- Users can see their own logs, admins see all
CREATE POLICY "marketplace_promotion_logs_owner_read"
    ON public.marketplace_promotion_logs
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- Seed default promotion tiers
INSERT INTO public.marketplace_promotion_tiers
    (tier_name, tier_level, display_name, description, price_pesewas, duration_hours, search_boost_multiplier, is_active)
VALUES
    ('bump', 1, 'Bump', 'Move to top of search results for 24 hours', 5000, 24, 1.2, true),
    ('boost', 2, 'Boost', 'Featured in category for 7 days', 15000, 168, 1.8, true),
    ('feature', 3, 'Feature', 'Featured on homepage + category for 14 days', 40000, 336, 2.5, true),
    ('spotlight', 4, 'Spotlight', 'Premium featured with badge for 30 days', 100000, 720, 3.5, true)
ON CONFLICT (tier_name) DO NOTHING;

COMMIT;
