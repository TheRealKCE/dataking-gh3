-- Database Trigger to automatically create a public user profile
-- Run this in your Supabase SQL Editor

-- 1. Create the function that handles the new user insertion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, phone_number, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    -- Extract metadata if available, otherwise default to empty strings
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    'customer',
    'active'
  )
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

-- 4. CLEANUP: If you have existing auth users who are missing from public.users, backfill them:
INSERT INTO public.users (id, email, first_name, last_name, phone_number)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'first_name', ''),
  COALESCE(raw_user_meta_data->>'last_name', ''),
  COALESCE(raw_user_meta_data->>'phone_number', '')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users);
