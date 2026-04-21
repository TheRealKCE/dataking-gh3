-- Create download_batches table if not exists
CREATE TABLE IF NOT EXISTS public.download_batches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES public.users(id),
  filename text NOT NULL,
  order_count integer NOT NULL DEFAULT 0,
  export_mode text,
  network text,
  idempotency_key text UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.download_batches
  ENABLE ROW LEVEL SECURITY;

-- Admins and sub-admins only
CREATE POLICY "Admins can manage download_batches"
  ON public.download_batches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'sub_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'sub_admin')
    )
  );

-- Atomic wallet credit (used for order refunds)
CREATE OR REPLACE FUNCTION public.credit_wallet_balance(
  p_user_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.wallets
  SET
    balance = balance + p_amount,
    total_spent = GREATEST(0, total_spent - p_amount),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;
