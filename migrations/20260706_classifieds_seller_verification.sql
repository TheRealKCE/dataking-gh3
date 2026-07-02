-- Migration: Classifieds Seller Verification System
-- Date: 2026-07-06

-- 1. Create classified_seller_verifications table
CREATE TABLE IF NOT EXISTS public.classified_seller_verifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    note TEXT,
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create partial unique index to allow only one pending request per seller
CREATE UNIQUE INDEX IF NOT EXISTS idx_classifieds_seller_verifications_pending
    ON public.classified_seller_verifications(seller_id)
    WHERE status = 'pending';

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_classifieds_seller_verifications_seller_id ON public.classified_seller_verifications(seller_id);
CREATE INDEX IF NOT EXISTS idx_classifieds_seller_verifications_status ON public.classified_seller_verifications(status);
CREATE INDEX IF NOT EXISTS idx_classifieds_seller_verifications_requested_at ON public.classified_seller_verifications(requested_at DESC);

-- 4. Enable RLS on verifications table
ALTER TABLE public.classified_seller_verifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - Verifications

-- Sellers can view their own verification requests
DROP POLICY IF EXISTS "Sellers can view own verification requests" ON public.classified_seller_verifications;
CREATE POLICY "Sellers can view own verification requests"
    ON public.classified_seller_verifications FOR SELECT
    TO authenticated
    USING (seller_id = auth.uid());

-- Sellers can create verification requests for themselves
DROP POLICY IF EXISTS "Sellers can create verification requests" ON public.classified_seller_verifications;
CREATE POLICY "Sellers can create verification requests"
    ON public.classified_seller_verifications FOR INSERT
    TO authenticated
    WITH CHECK (seller_id = auth.uid());

-- Admins can view all verification requests
DROP POLICY IF EXISTS "Admins can view all verification requests" ON public.classified_seller_verifications;
CREATE POLICY "Admins can view all verification requests"
    ON public.classified_seller_verifications FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('admin', 'sub-admin')
        )
    );

-- Admins can update verification requests
DROP POLICY IF EXISTS "Admins can update verification requests" ON public.classified_seller_verifications;
CREATE POLICY "Admins can update verification requests"
    ON public.classified_seller_verifications FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('admin', 'sub-admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('admin', 'sub-admin')
        )
    );

-- 6. Permissions
GRANT SELECT, INSERT ON public.classified_seller_verifications TO authenticated;
GRANT ALL ON public.classified_seller_verifications TO service_role;
