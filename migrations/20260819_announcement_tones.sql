-- ============================================================================
-- Announcement tones + shop announcement titles
-- Created: 2026-08-19
--
-- lib/announcement-tones.ts already defines four tones (official / shop /
-- success / alert) and components/announcements/announcement-modal.tsx already
-- renders all four. Nothing could ever *select* one: the storefront hardcoded
-- `type === 'admin' ? 'official' : 'shop'`, so every platform notice was amber
-- and every shop notice was blue.
--
-- These columns move that choice into the data, so an admin can post a red
-- service alert and a shop owner can post a green one.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. system_announcements: tone + overridable badge copy
-- ----------------------------------------------------------------------------
ALTER TABLE public.system_announcements
  ADD COLUMN IF NOT EXISTS tone        TEXT DEFAULT 'official',
  ADD COLUMN IF NOT EXISTS badge_label TEXT;

-- Backfill before the CHECK so existing rows cannot violate it.
UPDATE public.system_announcements SET tone = 'official' WHERE tone IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_announcements_tone_check') THEN
    ALTER TABLE public.system_announcements
      ADD CONSTRAINT system_announcements_tone_check
      CHECK (tone IN ('official', 'shop', 'success', 'alert'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. shop_announcements: title + tone
--
-- The table has only ever held `message`, which is why a shop announcement can
-- never show the bold headline an admin one does.
-- ----------------------------------------------------------------------------
ALTER TABLE public.shop_announcements
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS tone  TEXT DEFAULT 'shop';

UPDATE public.shop_announcements SET tone = 'shop' WHERE tone IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_announcements_tone_check') THEN
    ALTER TABLE public.shop_announcements
      ADD CONSTRAINT shop_announcements_tone_check
      CHECK (tone IN ('official', 'shop', 'success', 'alert'));
  END IF;
END $$;

-- Existing RLS on both tables is unchanged: these are new columns on rows that
-- were already readable/writable by the same people.
