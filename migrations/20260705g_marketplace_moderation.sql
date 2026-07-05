-- Marketplace Moderation System
-- Adds moderation_status to listings + audit trail

BEGIN;

-- Add moderation columns to existing classified_listings
ALTER TABLE IF EXISTS public.classified_listings
ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('draft', 'pending', 'approved', 'rejected', 'flagged')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_feedback JSONB,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create moderation actions audit table
CREATE TABLE IF NOT EXISTS public.marketplace_moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'flagged', 'unflagged')),
    previous_status TEXT,
    new_status TEXT,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT,
    feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create moderation reports table
CREATE TABLE IF NOT EXISTS public.marketplace_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('scam', 'fake', 'inappropriate', 'duplicate', 'spam', 'other')),
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_reporter_listing UNIQUE(reporter_id, listing_id)
);

-- Enable RLS
ALTER TABLE marketplace_moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reports ENABLE ROW LEVEL SECURITY;

-- RLS: Moderation actions (admin read, system write)
DROP POLICY IF EXISTS "Admin read moderation actions" ON marketplace_moderation_actions;
CREATE POLICY "Admin read moderation actions" ON marketplace_moderation_actions
    FOR SELECT USING (
        EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'sub-admin'))
    );

-- RLS: Reports (authenticated can create, admins read all, sellers see own listings)
DROP POLICY IF EXISTS "Authenticated create reports" ON marketplace_reports;
CREATE POLICY "Authenticated create reports" ON marketplace_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admin read all reports" ON marketplace_reports;
CREATE POLICY "Admin read all reports" ON marketplace_reports
    FOR SELECT USING (
        EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'sub-admin'))
    );

DROP POLICY IF EXISTS "Seller see reports on own listings" ON marketplace_reports;
CREATE POLICY "Seller see reports on own listings" ON marketplace_reports
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM classified_listings
            WHERE id = listing_id AND seller_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_moderation ON classified_listings(moderation_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_moderated_at ON classified_listings(moderated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_moderation_actions_listing ON marketplace_moderation_actions(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_moderation_actions_admin ON marketplace_moderation_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_moderation_actions_created ON marketplace_moderation_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_listing ON marketplace_reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_reporter ON marketplace_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_status ON marketplace_reports(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_created ON marketplace_reports(created_at DESC);

COMMIT;
