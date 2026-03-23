-- ============================================================
-- Airtime Orders Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Create airtime_orders table
CREATE TABLE IF NOT EXISTS public.airtime_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'customer',
  beneficiary_phone TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('MTN', 'Telecel', 'AT')),
  airtime_amount DECIMAL(12,2) NOT NULL CHECK (airtime_amount > 0),
  fee_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_paid DECIMAL(12,2) NOT NULL CHECK (total_paid > 0),
  use_exact_amount BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  reference_code TEXT NOT NULL UNIQUE,
  fulfillment_note TEXT,
  fulfilled_by UUID REFERENCES public.users(id),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_airtime_orders_user_id ON public.airtime_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_airtime_orders_status ON public.airtime_orders(status);
CREATE INDEX IF NOT EXISTS idx_airtime_orders_created_at ON public.airtime_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_airtime_orders_reference ON public.airtime_orders(reference_code);
CREATE INDEX IF NOT EXISTS idx_airtime_orders_beneficiary_phone ON public.airtime_orders(beneficiary_phone);

-- RLS
ALTER TABLE public.airtime_orders ENABLE ROW LEVEL SECURITY;

-- Users see only their own orders
CREATE POLICY "Users can view own airtime orders" ON public.airtime_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create airtime orders" ON public.airtime_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins and sub-admins see ALL orders (service-role bypasses RLS anyway, but this covers dashboard queries)
CREATE POLICY "Admins can view all airtime orders" ON public.airtime_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'sub-admin')
    )
  );

CREATE POLICY "Admins can update airtime orders" ON public.airtime_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'sub-admin')
    )
  );

-- Insert default admin_settings for airtime
INSERT INTO public.admin_settings (key, value) VALUES
  ('airtime_fee_mtn_customer', '5'),
  ('airtime_fee_mtn_agent', '3'),
  ('airtime_fee_telecel_customer', '5'),
  ('airtime_fee_telecel_agent', '3'),
  ('airtime_fee_at_customer', '5'),
  ('airtime_fee_at_agent', '3'),
  ('airtime_min_amount', '1'),
  ('airtime_max_amount', '500'),
  ('airtime_enabled_mtn', 'true'),
  ('airtime_enabled_telecel', 'true'),
  ('airtime_enabled_at', 'true'),
  ('page_access_airtime', 'true')
ON CONFLICT (key) DO NOTHING;
