-- Database Trigger to automatically create a public user profile
-- Run this in your Supabase SQL Editor

-- 1. Create the function that handles the new user insertion
--
-- Handles BOTH auth paths:
--   * Email/password sign-up  → metadata has first_name / last_name / phone_number
--   * Google OAuth sign-in     → metadata has full_name / name / given_name /
--                                family_name (Google NEVER sends first_name,
--                                last_name or phone_number)
--
-- phone_number is NOT NULL UNIQUE, and Google gives us no phone, so OAuth users
-- get a unique placeholder ('oauth_' + id prefix) that the become-seller /
-- phone-setup flow later overwrites with the real number. The UI hides this
-- placeholder (see buyer/profile page).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta   jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_full text  := COALESCE(NULLIF(meta->>'full_name', ''), NULLIF(meta->>'name', ''), '');
  v_first text;
  v_last  text;
  v_phone text;
BEGIN
  -- First name: explicit first_name → Google given_name → first word of full name
  v_first := COALESCE(
    NULLIF(meta->>'first_name', ''),
    NULLIF(meta->>'given_name', ''),
    NULLIF(split_part(v_full, ' ', 1), ''),
    ''
  );

  -- Last name: explicit last_name → Google family_name → remainder of full name
  v_last := COALESCE(
    NULLIF(meta->>'last_name', ''),
    NULLIF(meta->>'family_name', ''),
    CASE
      WHEN position(' ' in v_full) > 0
        THEN trim(substring(v_full from position(' ' in v_full) + 1))
      ELSE ''
    END
  );

  -- Phone: real number if provided, otherwise a unique OAuth placeholder so the
  -- NOT NULL UNIQUE constraint is satisfied without collisions.
  v_phone := COALESCE(
    NULLIF(meta->>'phone_number', ''),
    'oauth_' || substring(NEW.id::text, 1, 18)
  );

  INSERT INTO public.users (id, email, first_name, last_name, phone_number, role, status)
  VALUES (NEW.id, NEW.email, v_first, v_last, v_phone, 'customer', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- The wallet trigger will handle the wallet creation separately
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger to fire on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Ensure RLS allows the trigger to work (SECURITY DEFINER handles this, but good to check)
-- No extra policy needed for the trigger itself as it runs as superuser

-- 4. CLEANUP: backfill any auth users missing from public.users, extracting the
--    Google name the same way as above.
INSERT INTO public.users (id, email, first_name, last_name, phone_number)
SELECT
  au.id,
  au.email,
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'first_name', ''),
    NULLIF(au.raw_user_meta_data->>'given_name', ''),
    NULLIF(split_part(COALESCE(NULLIF(au.raw_user_meta_data->>'full_name',''), au.raw_user_meta_data->>'name', ''), ' ', 1), ''),
    ''
  ),
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'last_name', ''),
    NULLIF(au.raw_user_meta_data->>'family_name', ''),
    ''
  ),
  'oauth_' || substring(au.id::text, 1, 18)
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users);

-- 5. BACKFILL NAMES for existing Google users whose profile row was created
--    before this fix (first_name / last_name are empty). Pulls the name straight
--    from the stored Google metadata. Safe to re-run.
UPDATE public.users u
SET
  first_name = COALESCE(
    NULLIF(au.raw_user_meta_data->>'given_name', ''),
    NULLIF(split_part(COALESCE(NULLIF(au.raw_user_meta_data->>'full_name',''), au.raw_user_meta_data->>'name', ''), ' ', 1), ''),
    u.first_name
  ),
  last_name = COALESCE(
    NULLIF(au.raw_user_meta_data->>'family_name', ''),
    CASE
      WHEN position(' ' in COALESCE(NULLIF(au.raw_user_meta_data->>'full_name',''), au.raw_user_meta_data->>'name', '')) > 0
        THEN trim(substring(
          COALESCE(NULLIF(au.raw_user_meta_data->>'full_name',''), au.raw_user_meta_data->>'name', '')
          from position(' ' in COALESCE(NULLIF(au.raw_user_meta_data->>'full_name',''), au.raw_user_meta_data->>'name', '')) + 1))
      ELSE u.last_name
    END
  ),
  updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id
  AND (u.first_name IS NULL OR u.first_name = '')
  AND COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'given_name', '') <> '';
