-- Database trigger to set new users as 'pending' by default
-- This ensures all new signups require admin approval

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_new_user_pending ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_pending();

-- Create function to set new users as pending
CREATE OR REPLACE FUNCTION handle_new_user_pending()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user record in public.users to set account_status as 'pending'
  UPDATE public.users
  SET account_status = 'pending'
  WHERE id = NEW.id
    AND account_status IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after user is created in public.users
CREATE TRIGGER set_new_user_pending
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_pending();

-- Note: This assumes you have an existing trigger that creates users in public.users 
-- when auth.users are created (handle_new_user function or similar)
