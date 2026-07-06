-- Adds a picture URL for classified categories (main + sub). When set, the UI
-- renders this image instead of the lucide fallback icon. Images are uploaded
-- via the admin Categories page and stored (public) in the existing
-- `classified-listing-images` bucket under a `categories/` prefix; the column
-- holds the full public URL.
ALTER TABLE public.classified_categories ADD COLUMN IF NOT EXISTS image_url TEXT;
