-- Migration to add missing announcement features

-- 1. Update system_announcements table
-- Add visible_on column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_announcements' AND column_name = 'visible_on') THEN
        ALTER TABLE public.system_announcements ADD COLUMN visible_on TEXT DEFAULT 'main_site' CHECK (visible_on IN ('main_site', 'storefronts', 'both'));
    END IF;
END $$;

-- 2. Create shop_announcements table
CREATE TABLE IF NOT EXISTS public.shop_announcements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.shop_announcements ENABLE ROW LEVEL SECURITY;

-- 4. Policies for shop_announcements
DROP POLICY IF EXISTS "Public can read shop announcements" ON public.shop_announcements;
CREATE POLICY "Public can read shop announcements" 
    ON public.shop_announcements FOR SELECT 
    USING (is_active = true);

DROP POLICY IF EXISTS "Shop owners can manage their own announcements" ON public.shop_announcements;
CREATE POLICY "Shop owners can manage their own announcements" 
    ON public.shop_announcements FOR ALL 
    TO authenticated 
    USING (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
    );

-- 5. Permissions
GRANT SELECT ON public.shop_announcements TO anon, authenticated;
GRANT ALL ON public.shop_announcements TO service_role;
