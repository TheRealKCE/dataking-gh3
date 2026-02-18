-- ============================================================
-- Reseller Shop Engine — Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Shop Profiles
CREATE TABLE IF NOT EXISTS public.shop_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  shop_name TEXT NOT NULL,
  shop_slug TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Contact & Branding
  owner_phone TEXT NOT NULL,
  owner_email TEXT,
  whatsapp_number TEXT,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#2563eb',
  brand_accent TEXT DEFAULT '#1e40af',
  -- Admin Controls
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
  approval_note TEXT,
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  fulfillment_mode TEXT DEFAULT 'auto' CHECK (fulfillment_mode IN ('auto', 'manual')),
  -- Per-shop fee overrides (NULL = use global settings)
  paystack_fee_percent DECIMAL(5,2),
  withdrawal_fee_percent DECIMAL(5,2),
  withdrawal_fee_flat DECIMAL(12,2),
  min_withdrawal_amount DECIMAL(12,2),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Global Shop Settings (platform-wide defaults)
CREATE TABLE IF NOT EXISTS public.shop_global_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default global settings
INSERT INTO public.shop_global_settings (key, value) VALUES
  ('withdrawal_fee_percent', '5.0'),
  ('withdrawal_fee_flat', '0.0'),
  ('shop_paystack_fee_percent', '1.95'),
  ('min_withdrawal_amount', '10.0'),
  ('fulfillment_mode_default', '"auto"'),
  ('shop_feature_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Shop Pricing (custom prices per package per shop)
CREATE TABLE IF NOT EXISTS public.shop_pricing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES public.data_packages(id) ON DELETE CASCADE NOT NULL,
  selling_price DECIMAL(12, 2) NOT NULL,
  UNIQUE(shop_id, package_id)
);

-- Shop Wallet (SEPARATE from main wallet — tracks shop profit only)
CREATE TABLE IF NOT EXISTS public.shop_wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance DECIMAL(12, 2) DEFAULT 0.00,
  total_earned DECIMAL(12, 2) DEFAULT 0.00,
  total_withdrawn DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shop Wallet Transactions (profit ledger + withdrawal history)
CREATE TABLE IF NOT EXISTS public.shop_wallet_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_wallet_id UUID REFERENCES public.shop_wallets(id) ON DELETE CASCADE NOT NULL,
  shop_order_id UUID,
  type TEXT NOT NULL CHECK (type IN ('profit', 'withdrawal')),
  amount DECIMAL(12, 2) NOT NULL,
  fee DECIMAL(12, 2) DEFAULT 0.00,
  net_amount DECIMAL(12, 2),
  description TEXT NOT NULL,
  momo_number TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest Shop Orders
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES public.data_packages(id) NOT NULL,
  guest_phone TEXT NOT NULL,
  network TEXT NOT NULL,
  package_size TEXT NOT NULL,
  selling_price DECIMAL(12, 2) NOT NULL,
  cost_price DECIMAL(12, 2) NOT NULL,
  profit DECIMAL(12, 2) NOT NULL,
  paystack_reference TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  fulfillment_reference TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shop_profiles_slug ON public.shop_profiles(shop_slug);
CREATE INDEX IF NOT EXISTS idx_shop_profiles_owner ON public.shop_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_shop_profiles_status ON public.shop_profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_shop_pricing_shop ON public.shop_pricing(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_shop ON public.shop_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_guest_phone ON public.shop_orders(guest_phone);
CREATE INDEX IF NOT EXISTS idx_shop_orders_reference ON public.shop_orders(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_created ON public.shop_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_wallet_transactions_wallet ON public.shop_wallet_transactions(shop_wallet_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_global_settings ENABLE ROW LEVEL SECURITY;

-- Shop profiles: owners can read/update their own; public can read approved shops
CREATE POLICY "shop_profiles_owner_all" ON public.shop_profiles
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "shop_profiles_public_read" ON public.shop_profiles
  FOR SELECT USING (approval_status = 'approved' AND is_active = true);

-- Shop pricing: owners manage their own; public can read pricing for approved shops
CREATE POLICY "shop_pricing_owner_all" ON public.shop_pricing
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
  );

CREATE POLICY "shop_pricing_public_read" ON public.shop_pricing
  FOR SELECT USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE approval_status = 'approved' AND is_active = true)
  );

-- Shop wallets: owners can only read their own
CREATE POLICY "shop_wallets_owner_read" ON public.shop_wallets
  FOR SELECT USING (owner_id = auth.uid());

-- Shop wallet transactions: owners can read their own
CREATE POLICY "shop_wallet_transactions_owner_read" ON public.shop_wallet_transactions
  FOR SELECT USING (
    shop_wallet_id IN (SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid())
  );

-- Shop orders: owners can read their shop's orders; public can read by phone (for status page)
CREATE POLICY "shop_orders_owner_read" ON public.shop_orders
  FOR SELECT USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
  );

-- Global settings: authenticated users can read
CREATE POLICY "shop_global_settings_read" ON public.shop_global_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Supabase Storage Bucket for Shop Logos
-- Run this separately or via Supabase dashboard:
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('shop-logos', 'shop-logos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']);
