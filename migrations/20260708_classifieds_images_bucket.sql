-- Migration: Create Classifieds Listing Images Storage Bucket
-- Date: 2026-07-08

-- 1. Create the public bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('classified-listing-images', 'classified-listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. (RLS is already enabled by default on storage.objects in Supabase)

-- 3. Storage Policies

-- Anyone can view classifieds images
DROP POLICY IF EXISTS "Classifieds images are publicly accessible" ON storage.objects;
CREATE POLICY "Classifieds images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'classified-listing-images');

-- Authenticated users can upload images
DROP POLICY IF EXISTS "Authenticated users can upload classifieds images" ON storage.objects;
CREATE POLICY "Authenticated users can upload classifieds images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'classified-listing-images');

-- Users can update/delete their own images
DROP POLICY IF EXISTS "Users can update own classifieds images" ON storage.objects;
CREATE POLICY "Users can update own classifieds images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'classified-listing-images' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can delete own classifieds images" ON storage.objects;
CREATE POLICY "Users can delete own classifieds images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'classified-listing-images' AND auth.uid() = owner);
