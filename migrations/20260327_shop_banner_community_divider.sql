-- Migration: Add banner_url, community_link, divider_style to shop_profiles
-- Date: 2026-03-27
-- Safe to run multiple times (IF NOT EXISTS guards)

ALTER TABLE shop_profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS community_link text,
  ADD COLUMN IF NOT EXISTS divider_style text DEFAULT 'asymmetric-curve';

-- Note: Create a 'shop-banners' storage bucket in Supabase with public read access.
-- Use the same RLS policy as the existing 'shop-logos' bucket:
--   Policy name: Public Read
--   Operation: SELECT
--   Target roles: public
--   USING expression: true
