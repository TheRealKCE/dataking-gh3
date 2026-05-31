-- Migration: Add phone_verified column + Google OAuth support
-- Run in Supabase SQL Editor
-- Date: 2026-05-31

-- Step 1: Add phone_verified column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Mark all existing users as verified
-- (they provided real phone numbers at signup via email/password flow)
UPDATE public.users
  SET phone_verified = true
  WHERE phone_number IS NOT NULL
    AND phone_number != '';

-- Step 3: Update handle_new_user() trigger to set phone_verified correctly.
-- Email/password signups pass phone_number in raw_user_meta_data → verified = true.
-- Google OAuth signups have no phone → verified = false (must complete profile + OTP).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, email, first_name, last_name,
    phone_number, role, status, phone_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    'customer',
    'active',
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'phone_number', '') != ''
      THEN true
      ELSE false
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Prevent users from directly setting phone_verified via the Supabase REST API.
-- Only service-role key (used in our API routes) can change this column.
CREATE OR REPLACE FUNCTION public.prevent_direct_phone_verified_change()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.phone_verified != OLD.phone_verified THEN
    RAISE EXCEPTION 'Cannot directly modify phone_verified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS no_direct_phone_verified_change ON public.users;
CREATE TRIGGER no_direct_phone_verified_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_phone_verified_change();
