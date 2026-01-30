-- Migration: Fix User Role Assignment
-- This migration updates the role system to use 'customer', 'agent', 'sub-admin', 'admin'
-- instead of the old 'user', 'admin' system

-- Step 1: Drop the existing constraint on the role column
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Update existing users with role 'user' to 'customer' BEFORE adding new constraint
UPDATE public.users 
SET role = 'customer' 
WHERE role = 'user';

-- Step 3: Update any other invalid roles to 'customer' (safety measure)
UPDATE public.users 
SET role = 'customer' 
WHERE role NOT IN ('customer', 'agent', 'sub-admin', 'admin');

-- Step 4: Update the default value for new users
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'customer';

-- Step 5: Add new constraint with all valid roles (after data is cleaned)
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('customer', 'agent', 'sub-admin', 'admin'));

-- Step 6: Update the trigger function to use 'customer' instead of 'user'
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
    'customer',  -- Changed from 'user' to 'customer'
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- The wallet trigger will handle the wallet creation separately
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification: Show role distribution
SELECT role, COUNT(*) as count 
FROM public.users 
GROUP BY role 
ORDER BY role;
