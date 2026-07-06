-- Marketplace Full-Text Search
-- Setup tsvector for listings + GIN indexes + ranking

BEGIN;

-- Add search tsvector column to classified_listings
ALTER TABLE IF EXISTS public.classified_listings
ADD COLUMN IF NOT EXISTS search_tsvector tsvector;

-- Create trigger to auto-update tsvector on title/description changes
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
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_search_tsvector();

-- GIN index for tsvector (fast full-text search)
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_search_tsvector
  ON public.classified_listings
  USING GIN(search_tsvector);

-- Additional indexes can be added once schema is confirmed

-- Backfill existing listings with tsvector
UPDATE public.classified_listings
SET search_tsvector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_tsvector IS NULL AND status = 'active';

COMMIT;
