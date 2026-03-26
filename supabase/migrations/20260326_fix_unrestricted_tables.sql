-- Enable RLS on admin_profit_logs
ALTER TABLE public.admin_profit_logs ENABLE ROW LEVEL SECURITY;

-- Allow only admins to select from admin_profit_logs
CREATE POLICY "Admins can view profit logs"
ON public.admin_profit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Enable RLS on shop_pricing_logs
ALTER TABLE public.shop_pricing_logs ENABLE ROW LEVEL SECURITY;

-- Allow only admins to select from shop_pricing_logs
CREATE POLICY "Admins can view shop pricing logs"
ON public.shop_pricing_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);
