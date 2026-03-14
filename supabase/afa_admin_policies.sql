-- Drop existing policy if it exists to allow re-running the script
DROP POLICY IF EXISTS "Admin full access to afa_orders" ON public.afa_orders;

-- Allow admins and sub-admins full access to manage AFA applications
CREATE POLICY "Admin full access to afa_orders"
ON public.afa_orders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
);
