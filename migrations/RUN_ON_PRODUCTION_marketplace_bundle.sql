-- ============================================================================
-- ARHMS MARKETPLACE — PRODUCTION SETUP BUNDLE
-- ============================================================================
-- Paste this ENTIRE file into the Supabase SQL Editor and run it ONCE.
-- It is idempotent: safe to run more than once, and safe whether or not some
-- parts were already applied.
--
-- PREREQUISITE (must already exist in production — they power the live
-- classifieds feature): the classifieds base schema from
--   20260701_classifieds_schema.sql  (classified_categories, classified_listings,
--                                      classified_listing_images, classified_favorites,
--                                      users.is_seller, users.seller_verified_at)
--   20260702_classifieds_boosts.sql  (is_boosted, boosted_until, boost_tier)
-- If those are NOT present, run them first, then this bundle.
--
-- Order below follows table dependencies. Do not reorder.
-- ============================================================================


-- ============================================================================
-- 0. MISSING PROMOTION COLUMNS (gap fix)
--    The marketplace search/promote code reads & writes these on
--    classified_listings, but no prior migration created them.
-- ============================================================================
ALTER TABLE public.classified_listings
    ADD COLUMN IF NOT EXISTS promotion_tier   INTEGER,
    ADD COLUMN IF NOT EXISTS promoted_until   TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS bumped_at        TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_classified_listings_promotion_tier
    ON public.classified_listings(promotion_tier);
CREATE INDEX IF NOT EXISTS idx_classified_listings_bumped_at
    ON public.classified_listings(bumped_at DESC);


-- ============================================================================
-- 1. FEATURE FLAGS  (stays 'false' until you flip to 'admin' then 'true')
-- ============================================================================
INSERT INTO admin_settings (key, value) VALUES ('marketplace_enabled', '"false"')
    ON CONFLICT (key) DO NOTHING;
INSERT INTO admin_settings (key, value) VALUES ('page_access_marketplace', '"false"')
    ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 2. SELLER PROFILES
-- ============================================================================
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
ALTER TABLE marketplace_seller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read verified sellers" ON marketplace_seller_profiles;
CREATE POLICY "Public read verified sellers" ON marketplace_seller_profiles
    FOR SELECT USING (is_verified = TRUE);
DROP POLICY IF EXISTS "Seller read own profile" ON marketplace_seller_profiles;
CREATE POLICY "Seller read own profile" ON marketplace_seller_profiles
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Seller update own profile" ON marketplace_seller_profiles;
CREATE POLICY "Seller update own profile" ON marketplace_seller_profiles
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Seller insert own profile" ON marketplace_seller_profiles;
CREATE POLICY "Seller insert own profile" ON marketplace_seller_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin read all profiles" ON marketplace_seller_profiles;
CREATE POLICY "Admin read all profiles" ON marketplace_seller_profiles
    FOR SELECT USING (EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sub-admin')));

CREATE INDEX IF NOT EXISTS idx_marketplace_seller_profiles_region     ON marketplace_seller_profiles(region);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller_profiles_city       ON marketplace_seller_profiles(city);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller_profiles_verified   ON marketplace_seller_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller_profiles_created_at ON marketplace_seller_profiles(created_at DESC);


-- ============================================================================
-- 3. LISTING VARIANTS  (must exist before marketplace_orders references it)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_listing_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    option1_name TEXT, option1_value TEXT,
    option2_name TEXT, option2_value TEXT,
    price_delta_pesewas INTEGER DEFAULT 0,
    quantity INTEGER,
    is_available BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE marketplace_listing_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read approved variants" ON marketplace_listing_variants;
CREATE POLICY "Public read approved variants" ON marketplace_listing_variants
    FOR SELECT USING (EXISTS(SELECT 1 FROM classified_listings WHERE id = listing_id AND status = 'active'));
DROP POLICY IF EXISTS "Seller manage variants" ON marketplace_listing_variants;
CREATE POLICY "Seller manage variants" ON marketplace_listing_variants
    FOR ALL USING (EXISTS(SELECT 1 FROM classified_listings WHERE id = listing_id AND seller_id = auth.uid()));
DROP POLICY IF EXISTS "Admin read all variants" ON marketplace_listing_variants;
CREATE POLICY "Admin read all variants" ON marketplace_listing_variants
    FOR SELECT USING (EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sub-admin')));

CREATE INDEX IF NOT EXISTS idx_marketplace_variants_listing_id ON marketplace_listing_variants(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_variants_available  ON marketplace_listing_variants(is_available) WHERE is_available = TRUE;


-- ============================================================================
-- 4. CONVERSATIONS & MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','archived','resolved')),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT different_parties CHECK (buyer_id != seller_id),
    CONSTRAINT unique_conversation UNIQUE(listing_id, buyer_id, seller_id)
);
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.marketplace_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE marketplace_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own conversations" ON marketplace_conversations;
CREATE POLICY "Read own conversations" ON marketplace_conversations
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
DROP POLICY IF EXISTS "Create conversation" ON marketplace_conversations;
CREATE POLICY "Create conversation" ON marketplace_conversations
    FOR INSERT WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);
DROP POLICY IF EXISTS "Update own conversation" ON marketplace_conversations;
CREATE POLICY "Update own conversation" ON marketplace_conversations
    FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Read conversation messages" ON marketplace_messages;
CREATE POLICY "Read conversation messages" ON marketplace_messages
    FOR SELECT USING (EXISTS(SELECT 1 FROM marketplace_conversations WHERE id = conversation_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())));
DROP POLICY IF EXISTS "Send message" ON marketplace_messages;
CREATE POLICY "Send message" ON marketplace_messages
    FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS(SELECT 1 FROM marketplace_conversations WHERE id = conversation_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_buyer           ON marketplace_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_seller          ON marketplace_conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_listing         ON marketplace_conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_status          ON marketplace_conversations(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_last_message_at ON marketplace_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_conversation ON marketplace_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_sender       ON marketplace_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_created_at   ON marketplace_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_unread       ON marketplace_messages(read_at) WHERE read_at IS NULL;


-- ============================================================================
-- 5. MODERATION  (adds moderation_status to classified_listings + audit tables)
--    Runs BEFORE the guard trigger so the column exists first.
-- ============================================================================
ALTER TABLE public.classified_listings
    ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('draft','pending','approved','rejected','flagged')),
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejection_feedback JSONB,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.marketplace_moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('submitted','approved','rejected','flagged','unflagged')),
    previous_status TEXT, new_status TEXT,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT, feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.marketplace_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('scam','fake','inappropriate','duplicate','spam','other')),
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewing','resolved','dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_reporter_listing UNIQUE(reporter_id, listing_id)
);
ALTER TABLE marketplace_moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read moderation actions" ON marketplace_moderation_actions;
CREATE POLICY "Admin read moderation actions" ON marketplace_moderation_actions
    FOR SELECT USING (EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sub-admin')));
DROP POLICY IF EXISTS "Authenticated create reports" ON marketplace_reports;
CREATE POLICY "Authenticated create reports" ON marketplace_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Admin read all reports" ON marketplace_reports;
CREATE POLICY "Admin read all reports" ON marketplace_reports
    FOR SELECT USING (EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sub-admin')));
DROP POLICY IF EXISTS "Seller see reports on own listings" ON marketplace_reports;
CREATE POLICY "Seller see reports on own listings" ON marketplace_reports
    FOR SELECT USING (EXISTS(SELECT 1 FROM classified_listings WHERE id = listing_id AND seller_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_moderation        ON classified_listings(moderation_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_moderated_at      ON classified_listings(moderated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_moderation_actions_listing ON marketplace_moderation_actions(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_moderation_actions_admin   ON marketplace_moderation_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_moderation_actions_created ON marketplace_moderation_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_listing  ON marketplace_reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_reporter ON marketplace_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_status   ON marketplace_reports(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_created  ON marketplace_reports(created_at DESC);


-- ============================================================================
-- 6. GUARD TRIGGER (sellers may only move moderation_status draft <-> pending)
-- ============================================================================
DROP FUNCTION IF EXISTS prevent_self_promotion() CASCADE;
CREATE FUNCTION prevent_self_promotion()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    is_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    SELECT EXISTS(SELECT 1 FROM users WHERE id = v_user_id AND role IN ('admin','sub-admin')) INTO is_admin;
    IF NOT is_admin THEN
        IF OLD.moderation_status IS DISTINCT FROM NEW.moderation_status THEN
            IF NOT (
                (OLD.moderation_status = 'draft'   AND NEW.moderation_status = 'pending') OR
                (OLD.moderation_status = 'pending' AND NEW.moderation_status = 'draft')
            ) THEN
                RAISE EXCEPTION 'Sellers can only move listings between draft and pending';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_self_promotion_trigger ON public.classified_listings;
CREATE TRIGGER prevent_self_promotion_trigger
    BEFORE UPDATE ON public.classified_listings
    FOR EACH ROW EXECUTE FUNCTION prevent_self_promotion();


-- ============================================================================
-- 7. FULL-TEXT SEARCH (tsvector + GIN + backfill)
-- ============================================================================
ALTER TABLE public.classified_listings ADD COLUMN IF NOT EXISTS search_tsvector tsvector;

CREATE OR REPLACE FUNCTION update_marketplace_search_tsvector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsvector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketplace_search_tsvector_trigger ON public.classified_listings;
CREATE TRIGGER marketplace_search_tsvector_trigger
  BEFORE INSERT OR UPDATE ON public.classified_listings
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_search_tsvector();

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_search_tsvector
  ON public.classified_listings USING GIN(search_tsvector);

UPDATE public.classified_listings
SET search_tsvector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_tsvector IS NULL AND status = 'active';


-- ============================================================================
-- 8. ORDERS  (needs marketplace_listing_variants from section 3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES public.marketplace_listing_variants(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    price_pesewas INTEGER NOT NULL CHECK (price_pesewas > 0),
    commission_rate_percent NUMERIC(5,2) DEFAULT 0,
    commission_pesewas INTEGER DEFAULT 0,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('direct','split','escrow')),
    status TEXT DEFAULT 'created' CHECK (status IN ('created','paid_escrowed','shipped','delivered_confirmed','released','settled','refunded','disputed','cancelled')),
    variant_snapshot JSONB,
    reference_code TEXT UNIQUE,
    buyer_notes TEXT, seller_notes TEXT,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyer read own orders" ON marketplace_orders;
CREATE POLICY "Buyer read own orders" ON marketplace_orders FOR SELECT USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Seller read own orders" ON marketplace_orders;
CREATE POLICY "Seller read own orders" ON marketplace_orders FOR SELECT USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Buyer create order" ON marketplace_orders;
CREATE POLICY "Buyer create order" ON marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Buyer update order notes" ON marketplace_orders;
CREATE POLICY "Buyer update order notes" ON marketplace_orders FOR UPDATE USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Seller update order" ON marketplace_orders;
CREATE POLICY "Seller update order" ON marketplace_orders FOR UPDATE USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Admin read all orders" ON marketplace_orders;
CREATE POLICY "Admin read all orders" ON marketplace_orders FOR SELECT USING (EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','sub-admin')));

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer        ON marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller       ON marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_listing      ON marketplace_orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status       ON marketplace_orders(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_reference    ON marketplace_orders(reference_code);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_created_at   ON marketplace_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_payment_mode ON marketplace_orders(payment_mode);


-- ============================================================================
-- 9. ESCROW / PAYMENT TX / ORDER EVENTS  (needs marketplace_orders)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_escrow (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
    amount_pesewas integer NOT NULL,
    status text NOT NULL DEFAULT 'held',
    held_at timestamp with time zone DEFAULT now(),
    released_at timestamp with time zone,
    reason_if_released text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_status CHECK (status IN ('held','released','refunded','disputed')),
    CONSTRAINT positive_amount CHECK (amount_pesewas > 0),
    UNIQUE(order_id)
);
CREATE TABLE IF NOT EXISTS public.marketplace_payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
    payer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_pesewas integer NOT NULL,
    payment_method text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    gateway_reference text,
    metadata jsonb,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_status CHECK (status IN ('pending','completed','failed','refunded')),
    CONSTRAINT positive_amount CHECK (amount_pesewas > 0)
);
CREATE TABLE IF NOT EXISTS public.marketplace_order_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    actor_id uuid REFERENCES auth.users(id),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_escrow_buyer_id ON public.marketplace_escrow(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_escrow_order_id ON public.marketplace_escrow(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_escrow_status   ON public.marketplace_escrow(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_payment_transactions_order_id ON public.marketplace_payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payment_transactions_payer_id ON public.marketplace_payment_transactions(payer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payment_transactions_payee_id ON public.marketplace_payment_transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payment_transactions_status   ON public.marketplace_payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_events_order_id ON public.marketplace_order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_events_actor_id ON public.marketplace_order_events(actor_id);

ALTER TABLE public.marketplace_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_escrow_buyer_read" ON public.marketplace_escrow;
CREATE POLICY "marketplace_escrow_buyer_read" ON public.marketplace_escrow
    FOR SELECT USING (buyer_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS "marketplace_escrow_admin_write" ON public.marketplace_escrow;
CREATE POLICY "marketplace_escrow_admin_write" ON public.marketplace_escrow
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'is_admin' = 'true');
DROP POLICY IF EXISTS "marketplace_payment_transactions_read" ON public.marketplace_payment_transactions;
CREATE POLICY "marketplace_payment_transactions_read" ON public.marketplace_payment_transactions
    FOR SELECT USING (payer_id = auth.uid() OR payee_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS "marketplace_order_events_read" ON public.marketplace_order_events;
CREATE POLICY "marketplace_order_events_read" ON public.marketplace_order_events
    FOR SELECT USING (order_id IN (SELECT id FROM public.marketplace_orders WHERE buyer_id = auth.uid() OR seller_id = auth.uid()) OR auth.jwt() ->> 'role' = 'admin');


-- ============================================================================
-- 10. PROMOTIONS (tiers + purchases + logs + seed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_promotion_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name text NOT NULL UNIQUE,
    tier_level integer NOT NULL UNIQUE,
    display_name text NOT NULL,
    description text,
    price_pesewas integer NOT NULL,
    duration_hours integer NOT NULL,
    search_boost_multiplier numeric(3,2) NOT NULL DEFAULT 1.0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_tier_level CHECK (tier_level BETWEEN 1 AND 4),
    CONSTRAINT positive_price CHECK (price_pesewas > 0),
    CONSTRAINT positive_duration CHECK (duration_hours > 0),
    CONSTRAINT valid_boost CHECK (search_boost_multiplier > 0)
);
CREATE TABLE IF NOT EXISTS public.marketplace_promotion_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id uuid NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    tier_id uuid NOT NULL REFERENCES public.marketplace_promotion_tiers(id),
    price_pesewas integer NOT NULL,
    status text NOT NULL DEFAULT 'active',
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_status CHECK (status IN ('active','expired','cancelled'))
);
CREATE TABLE IF NOT EXISTS public.marketplace_promotion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id uuid NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    tier_id uuid NOT NULL REFERENCES public.marketplace_promotion_tiers(id),
    action text NOT NULL,
    amount_pesewas integer,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_purchases_user_id   ON public.marketplace_promotion_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_purchases_listing_id ON public.marketplace_promotion_purchases(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_purchases_status    ON public.marketplace_promotion_purchases(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_purchases_expires_at ON public.marketplace_promotion_purchases(expires_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_logs_user_id    ON public.marketplace_promotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_promotion_logs_listing_id ON public.marketplace_promotion_logs(listing_id);

ALTER TABLE public.marketplace_promotion_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_promotion_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_promotion_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_promotion_tiers_public_read" ON public.marketplace_promotion_tiers;
CREATE POLICY "marketplace_promotion_tiers_public_read" ON public.marketplace_promotion_tiers
    FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "marketplace_promotion_tiers_admin_write" ON public.marketplace_promotion_tiers;
CREATE POLICY "marketplace_promotion_tiers_admin_write" ON public.marketplace_promotion_tiers
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'is_admin' = 'true');
DROP POLICY IF EXISTS "marketplace_promotion_purchases_owner_read" ON public.marketplace_promotion_purchases;
CREATE POLICY "marketplace_promotion_purchases_owner_read" ON public.marketplace_promotion_purchases
    FOR SELECT USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS "marketplace_promotion_purchases_owner_insert" ON public.marketplace_promotion_purchases;
CREATE POLICY "marketplace_promotion_purchases_owner_insert" ON public.marketplace_promotion_purchases
    FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "marketplace_promotion_purchases_admin_write" ON public.marketplace_promotion_purchases;
CREATE POLICY "marketplace_promotion_purchases_admin_write" ON public.marketplace_promotion_purchases
    FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'is_admin' = 'true');
DROP POLICY IF EXISTS "marketplace_promotion_logs_owner_read" ON public.marketplace_promotion_logs;
CREATE POLICY "marketplace_promotion_logs_owner_read" ON public.marketplace_promotion_logs
    FOR SELECT USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

INSERT INTO public.marketplace_promotion_tiers
    (tier_name, tier_level, display_name, description, price_pesewas, duration_hours, search_boost_multiplier, is_active)
VALUES
    ('bump',      1, 'Bump',      'Move to top of search results for 24 hours', 5000,  24,  1.2, true),
    ('boost',     2, 'Boost',     'Featured in category for 7 days',            15000, 168, 1.8, true),
    ('feature',   3, 'Feature',   'Featured on homepage + category for 14 days',40000, 336, 2.5, true),
    ('spotlight', 4, 'Spotlight', 'Premium featured with badge for 30 days',    100000,720, 3.5, true)
ON CONFLICT (tier_name) DO NOTHING;


-- ============================================================================
-- 11. SELLER VERIFICATION (classifieds)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.classified_seller_verifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    note TEXT, rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_classifieds_seller_verifications_pending
    ON public.classified_seller_verifications(seller_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_classifieds_seller_verifications_seller_id    ON public.classified_seller_verifications(seller_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_seller_verifications_status       ON public.classified_seller_verifications(status);
CREATE INDEX IF NOT EXISTS idx_classifieds_seller_verifications_requested_at ON public.classified_seller_verifications(requested_at DESC);
ALTER TABLE public.classified_seller_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can view own verification requests" ON public.classified_seller_verifications;
CREATE POLICY "Sellers can view own verification requests" ON public.classified_seller_verifications
    FOR SELECT TO authenticated USING (seller_id = auth.uid());
DROP POLICY IF EXISTS "Sellers can create verification requests" ON public.classified_seller_verifications;
CREATE POLICY "Sellers can create verification requests" ON public.classified_seller_verifications
    FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all verification requests" ON public.classified_seller_verifications;
CREATE POLICY "Admins can view all verification requests" ON public.classified_seller_verifications
    FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.users WHERE public.users.id = auth.uid() AND public.users.role IN ('admin','sub-admin')));
DROP POLICY IF EXISTS "Admins can update verification requests" ON public.classified_seller_verifications;
CREATE POLICY "Admins can update verification requests" ON public.classified_seller_verifications
    FOR UPDATE TO authenticated
    USING (EXISTS(SELECT 1 FROM public.users WHERE public.users.id = auth.uid() AND public.users.role IN ('admin','sub-admin')))
    WITH CHECK (EXISTS(SELECT 1 FROM public.users WHERE public.users.id = auth.uid() AND public.users.role IN ('admin','sub-admin')));

GRANT SELECT, INSERT ON public.classified_seller_verifications TO authenticated;
GRANT ALL ON public.classified_seller_verifications TO service_role;


-- ============================================================================
-- 12. PUBLIC-SAFE SELLER VIEW  (fixes the "Verified" badge for anon visitors)
-- ============================================================================
CREATE OR REPLACE VIEW public.classified_sellers_public AS
SELECT id, first_name, last_name, seller_verified_at
FROM public.users
WHERE is_seller = true;
GRANT SELECT ON public.classified_sellers_public TO anon, authenticated;


-- ============================================================================
-- 13. SOCIAL LINKS (classifieds listing contact fields)
-- ============================================================================
ALTER TABLE public.classified_listings
    ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS facebook_url TEXT,
    ADD COLUMN IF NOT EXISTS twitter_url TEXT,
    ADD COLUMN IF NOT EXISTS instagram_url TEXT;


-- ============================================================================
-- 14. LISTING IMAGES STORAGE BUCKET + POLICIES
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('classified-listing-images', 'classified-listing-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Classifieds images are publicly accessible" ON storage.objects;
CREATE POLICY "Classifieds images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'classified-listing-images');
DROP POLICY IF EXISTS "Authenticated users can upload classifieds images" ON storage.objects;
CREATE POLICY "Authenticated users can upload classifieds images" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'classified-listing-images');
DROP POLICY IF EXISTS "Users can update own classifieds images" ON storage.objects;
CREATE POLICY "Users can update own classifieds images" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'classified-listing-images' AND auth.uid() = owner);
DROP POLICY IF EXISTS "Users can delete own classifieds images" ON storage.objects;
CREATE POLICY "Users can delete own classifieds images" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'classified-listing-images' AND auth.uid() = owner);


-- ============================================================================
-- 15. CATEGORY ICONS (adds icon column + populates lucide icon names)
-- ============================================================================
ALTER TABLE public.classified_categories ADD COLUMN IF NOT EXISTS icon VARCHAR(50);

-- Main categories
UPDATE public.classified_categories SET icon = 'Smartphone' WHERE slug = 'electronics' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Home'       WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Shirt'      WHERE slug = 'fashion' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Sparkles'   WHERE slug = 'beauty-personal-care' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Wrench'     WHERE slug = 'repair-construction' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Hammer'     WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Trophy'     WHERE slug = 'leisure-activities' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Baby'       WHERE slug = 'babies-kids' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Car'        WHERE slug = 'vehicles' AND parent_id IS NULL;
-- Subcategories
UPDATE public.classified_categories SET icon = 'Laptop'     WHERE slug = 'laptops-computers';
UPDATE public.classified_categories SET icon = 'Tv'         WHERE slug = 'tv-video-equipment';
UPDATE public.classified_categories SET icon = 'Gamepad2'   WHERE slug = 'video-game-consoles';
UPDATE public.classified_categories SET icon = 'Music'      WHERE slug = 'audio-music-equipment';
UPDATE public.classified_categories SET icon = 'Headphones' WHERE slug = 'headphones';
UPDATE public.classified_categories SET icon = 'Camera'     WHERE slug = 'photo-video-cameras';
UPDATE public.classified_categories SET icon = 'Video'      WHERE slug = 'security-surveillance';
UPDATE public.classified_categories SET icon = 'Wifi'       WHERE slug = 'networking-products';
UPDATE public.classified_categories SET icon = 'Printer'    WHERE slug = 'printers-scanners';
UPDATE public.classified_categories SET icon = 'Monitor'    WHERE slug = 'computer-monitors';
UPDATE public.classified_categories SET icon = 'Smartphone' WHERE slug = 'mobile-phones-accessories';
UPDATE public.classified_categories SET icon = 'Armchair'   WHERE slug = 'furniture';
UPDATE public.classified_categories SET icon = 'Lightbulb'  WHERE slug = 'lighting';
UPDATE public.classified_categories SET icon = 'Box'        WHERE slug = 'storage-organization';
UPDATE public.classified_categories SET icon = 'Home'       WHERE slug = 'home-accessories';
UPDATE public.classified_categories SET icon = 'Microwave'  WHERE slug = 'home-appliances';
UPDATE public.classified_categories SET icon = 'UtensilsCrossed' WHERE slug = 'kitchen-appliances';
UPDATE public.classified_categories SET icon = 'UtensilsCrossed' WHERE slug = 'kitchenware-cookware';
UPDATE public.classified_categories SET icon = 'Droplet'    WHERE slug = 'household-chemicals';
UPDATE public.classified_categories SET icon = 'Leaf'       WHERE slug = 'garden-supplies';
UPDATE public.classified_categories SET icon = 'Shirt'      WHERE slug = 'womens-fashion';
UPDATE public.classified_categories SET icon = 'Shirt'      WHERE slug = 'mens-fashion';
UPDATE public.classified_categories SET icon = 'Baby'       WHERE slug = 'baby-kids-fashion';
UPDATE public.classified_categories SET icon = 'Scissors'   WHERE slug = 'hair-beauty';
UPDATE public.classified_categories SET icon = 'Droplet'    WHERE slug = 'face-care';
UPDATE public.classified_categories SET icon = 'Smile'      WHERE slug = 'oral-care';
UPDATE public.classified_categories SET icon = 'Droplets'   WHERE slug = 'body-care';
UPDATE public.classified_categories SET icon = 'Flower'     WHERE slug = 'fragrance';
UPDATE public.classified_categories SET icon = 'Palette'    WHERE slug = 'makeup';
UPDATE public.classified_categories SET icon = 'Pill'       WHERE slug = 'vitamins-supplements';
UPDATE public.classified_categories SET icon = 'Zap'        WHERE slug = 'electrical-equipment';
UPDATE public.classified_categories SET icon = 'Blocks'     WHERE slug = 'building-materials-supplies';
UPDATE public.classified_categories SET icon = 'Droplet'    WHERE slug = 'plumbing-water-systems';
UPDATE public.classified_categories SET icon = 'Hammer'     WHERE slug = 'hand-tools';
UPDATE public.classified_categories SET icon = 'Bolt'       WHERE slug = 'hardware-fasteners';
UPDATE public.classified_categories SET icon = 'DoorOpen'   WHERE slug = 'doors-security';
UPDATE public.classified_categories SET icon = 'Gamepad2'   WHERE slug = 'toys-games';
UPDATE public.classified_categories SET icon = 'Bed'        WHERE slug = 'childrens-furniture';
UPDATE public.classified_categories SET icon = 'Shirt'      WHERE slug = 'childrens-clothing';
UPDATE public.classified_categories SET icon = 'Footprints' WHERE slug = 'childrens-shoes';
UPDATE public.classified_categories SET icon = 'Backpack'   WHERE slug = 'babies-kids-accessories';
UPDATE public.classified_categories SET icon = 'Baby'       WHERE slug = 'baby-gear-equipment';
UPDATE public.classified_categories SET icon = 'Baby'       WHERE slug = 'care-feeding';
UPDATE public.classified_categories SET icon = 'Heart'      WHERE slug = 'maternity-pregnancy';
UPDATE public.classified_categories SET icon = 'Car'        WHERE slug = 'transport-safety';
UPDATE public.classified_categories SET icon = 'Smile'      WHERE slug = 'playground-equipment';
UPDATE public.classified_categories SET icon = 'BookOpen'   WHERE slug = 'child-care-education';
UPDATE public.classified_categories SET icon = 'Zap'        WHERE slug = 'personal-mobility';
UPDATE public.classified_categories SET icon = 'Trophy'     WHERE slug = 'sports-equipment';
UPDATE public.classified_categories SET icon = 'Hand'       WHERE slug = 'massagers';
UPDATE public.classified_categories SET icon = 'Music'      WHERE slug = 'musical-instruments-gear';
UPDATE public.classified_categories SET icon = 'BookOpen'   WHERE slug = 'books-table-games';
UPDATE public.classified_categories SET icon = 'Palette'    WHERE slug = 'arts-crafts-awards';
UPDATE public.classified_categories SET icon = 'Tent'       WHERE slug = 'outdoor-gear';
UPDATE public.classified_categories SET icon = 'Cigarette'  WHERE slug = 'smoking-accessories';
UPDATE public.classified_categories SET icon = 'Film'       WHERE slug = 'music-video';
UPDATE public.classified_categories SET icon = 'Dumbbell'   WHERE slug = 'fitness-personal-training';
UPDATE public.classified_categories SET icon = 'Settings'   WHERE slug = 'vehicle-parts-accessories';
UPDATE public.classified_categories SET icon = 'Car'        WHERE slug = 'cars';
UPDATE public.classified_categories SET icon = 'Bike'       WHERE slug = 'motorcycles-scooters';
UPDATE public.classified_categories SET icon = 'Bus'        WHERE slug = 'buses-microbuses';
UPDATE public.classified_categories SET icon = 'Truck'      WHERE slug = 'trucks-trailers';
UPDATE public.classified_categories SET icon = 'Hammer'     WHERE slug = 'construction-heavy-machinery';
UPDATE public.classified_categories SET icon = 'Anchor'     WHERE slug = 'watercraft-boats';
UPDATE public.classified_categories SET icon = 'Wrench'     WHERE slug = 'car-services';
UPDATE public.classified_categories SET icon = 'Hammer'     WHERE slug = 'heavy-machinery';
UPDATE public.classified_categories SET icon = 'Zap'        WHERE slug = 'power-tools';
UPDATE public.classified_categories SET icon = 'Wrench'     WHERE slug = 'hand-tools-equipment';
UPDATE public.classified_categories SET icon = 'Monitor'    WHERE slug = 'office-equipment-furniture';
UPDATE public.classified_categories SET icon = 'Zap'        WHERE slug = 'industrial-generators';
UPDATE public.classified_categories SET icon = 'Flame'      WHERE slug = 'welding-fabrication';
UPDATE public.classified_categories SET icon = 'Droplet'    WHERE slug = 'pumps-water-equipment';
UPDATE public.classified_categories SET icon = 'Wind'       WHERE slug = 'compressors-air-tools';
UPDATE public.classified_categories SET icon = 'Shield'     WHERE slug = 'safety-equipment';
UPDATE public.classified_categories SET icon = 'Settings'   WHERE slug = 'hydraulic-equipment';
UPDATE public.classified_categories SET icon = 'Factory'    WHERE slug = 'workshop-machinery';
UPDATE public.classified_categories SET icon = 'Box'        WHERE slug = 'material-handling';

-- Reload PostgREST schema cache so the new columns/views are exposed immediately
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- DONE. Verify with:
--   SELECT key, value FROM admin_settings WHERE key LIKE 'marketplace%';
--   SELECT count(*) FROM marketplace_promotion_tiers;
--   SELECT slug, icon FROM classified_categories WHERE icon IS NOT NULL LIMIT 10;
-- ============================================================================
