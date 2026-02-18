-- ============================================================
-- Fix Shop Logos Storage Bucket
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-logos', 'shop-logos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- 2. Enable RLS on objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public Read Access
-- Anyone can view shop logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Shop Logos'
  ) THEN
    CREATE POLICY "Public Access Shop Logos"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'shop-logos' );
  END IF;
END
$$;

-- 4. Policy: Authenticated Upload
-- Users can upload files to their own folder: shop-logos/{uid}/{filename}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth Upload Shop Logos'
  ) THEN
    CREATE POLICY "Auth Upload Shop Logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'shop-logos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END
$$;

-- 5. Policy: Authenticated Update
-- Users can update their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth Update Shop Logos'
  ) THEN
    CREATE POLICY "Auth Update Shop Logos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'shop-logos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END
$$;

-- 6. Policy: Authenticated Delete
-- Users can delete their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth Delete Shop Logos'
  ) THEN
    CREATE POLICY "Auth Delete Shop Logos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'shop-logos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END
$$;
