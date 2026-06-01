-- Migration: Add phone_verified column + Google OAuth support
-- Run in Supabase SQL Editor
-- Date: 2026-05-31

-- Step 1: Drop the blocking trigger first (safe if it doesn't exist yet)
DROP TRIGGER IF EXISTS no_direct_phone_verified_change ON public.users;

-- Step 2: Add phone_verified column (safe to run even if already exists)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Mark all EXISTING users with real phone numbers as already verified
-- (they signed up via email/password and already provided valid numbers)
UPDATE public.users
  SET phone_verified = true
  WHERE phone_number IS NOT NULL
    AND phone_number != '';

-- Step 4: Update handle_new_user() trigger for Google OAuth support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    phone_number,
    role,
    status,
    phone_verified
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

-- Step 5: Re-create the security trigger (allows service_role, blocks end-users)
CREATE OR REPLACE FUNCTION public.prevent_direct_phone_verified_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role (our API routes) to always change phone_verified
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Block any authenticated end-user from directly toggling phone_verified
  IF auth.uid() IS NOT NULL AND (NEW.phone_verified IS DISTINCT FROM OLD.phone_verified) THEN
    RAISE EXCEPTION 'Cannot directly modify phone_verified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER no_direct_phone_verified_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_phone_verified_change();