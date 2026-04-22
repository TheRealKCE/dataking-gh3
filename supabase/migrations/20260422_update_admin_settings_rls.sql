-- Drop the restrictive read policy
DROP POLICY IF EXISTS "Admin read access to admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Anyone can read admin settings" ON public.admin_settings;

-- Create a new policy that allows anyone to read from admin_settings
CREATE POLICY "Anyone can read admin settings"
ON public.admin_settings
FOR SELECT
TO anon, authenticated
USING (true);
