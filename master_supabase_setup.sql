-- ==========================================
-- MASTER SUPABASE DEPLOYMENT SCRIPT
-- Auto-generated consolidation of all SQL migrations and scripts
-- ==========================================



-- ==================================================
-- 1. EXTENSIONS
-- ==================================================

-- Source: supabase/schema.sql
-- ARHMS Database Schema for Supabase
-- Run this in the SQL Editor of your Supabase project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";



-- ==================================================
-- 3. TABLES
-- ==================================================

-- Source: supabase/schema.sql
-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'agent', 'sub-admin', 'admin')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  agent_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance DECIMAL(12, 2) DEFAULT 0.00,
  total_credited DECIMAL(12, 2) DEFAULT 0.00,
  total_spent DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  source TEXT NOT NULL CHECK (source IN ('payment', 'refund', 'admin', 'purchase')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Wallet payments
CREATE TABLE IF NOT EXISTS public.wallet_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  fee DECIMAL(12, 2) DEFAULT 0.00,
  total_amount DECIMAL(12, 2) NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  provider TEXT DEFAULT 'paystack',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  provider_reference TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Data packages
CREATE TABLE IF NOT EXISTS public.data_packages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  network TEXT NOT NULL CHECK (network IN ('MTN', 'Telecel', 'AT-iShare', 'AT-BigTime')),
  size TEXT NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  cost_price DECIMAL(12, 2) DEFAULT 0.00, -- Added cost price
  description TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  phone_number TEXT NOT NULL,
  network TEXT NOT NULL,
  size TEXT NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  cost_price DECIMAL(12, 2) DEFAULT 0.00, -- Snapshot of cost price
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'refunded')),
  reference_code TEXT NOT NULL UNIQUE,
  fulfillment_method TEXT DEFAULT 'auto' CHECK (fulfillment_method IN ('auto', 'manual', 'codecraft', 'datakazina', 'kingflexy')),
  codecraft_reference TEXT,
  dakazina_reference TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order_update', 'complaint_resolved', 'payment_success', 'balance_updated', 'system')),
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'rejected')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  resolution_notes TEXT,
  evidence JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- MTN Fulfillment Tracking
CREATE TABLE IF NOT EXISTS public.mtn_fulfillment_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  api_response JSONB,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Fulfillment Logs (for CodeCraft)
CREATE TABLE IF NOT EXISTS public.fulfillment_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  api_response JSONB,
  codecraft_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Admin Settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Phone Blacklist
CREATE TABLE IF NOT EXISTS public.phone_blacklist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- AFA Orders (Agent Application)
CREATE TABLE IF NOT EXISTS public.afa_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  ghana_card TEXT NOT NULL,
  location TEXT NOT NULL,
  region TEXT NOT NULL,
  occupation TEXT NOT NULL,
  date_of_birth DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/schema.sql
-- Customer Purchases (tracking endpoint users)
CREATE TABLE IF NOT EXISTS public.customer_purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  customer_phone TEXT NOT NULL,
  total_purchases INT DEFAULT 0,
  total_spent DECIMAL(12, 2) DEFAULT 0.00,
  first_purchase_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_purchase_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, customer_phone)
);

-- Source: supabase/schema.sql
CREATE TABLE IF NOT EXISTS public.system_announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  message text not null,
  is_active boolean default true,
  visible_on text default 'main_site' check (visible_on in ('main_site', 'storefronts', 'both')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Source: supabase/migrations/20250001000000_download_batches_rls.sql
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

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
-- 2. Audit Table
CREATE TABLE IF NOT EXISTS public.shop_pricing_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
    old_cost_price DECIMAL(12,2),
    new_cost_price DECIMAL(12,2),
    old_selling_price DECIMAL(12,2),
    new_selling_price DECIMAL(12,2),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
-- ============================================================================
-- 3. ADMIN_PROFIT_LOGS TABLE (IMMUTABLE AUDIT TRAIL)
-- Strict ledger for all finalized profit bounds
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_profit_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_type      TEXT NOT NULL CHECK (transaction_type IN ('main', 'shop')),
  transaction_id        UUID NOT NULL,
  channel               TEXT NOT NULL CHECK (channel IN ('main', 'shop')),
  role_at_time          TEXT,
  selling_price         DECIMAL(12,2),           -- main: orders.price
  amount_paid_to_admin  DECIMAL(12,2),           -- shop: shop_orders.cost_price
  admin_cost            DECIMAL(12,2) NOT NULL,  -- true supplier cost
  profit                DECIMAL(12,2) NOT NULL,  -- calculated result (revenue - cost)
  is_loss               BOOLEAN GENERATED ALWAYS AS (profit < 0) STORED, -- Flags negative profit instantly
  calculation_note      TEXT NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),

  -- Idempotency guarantee: one log per transaction_id and type
  CONSTRAINT uniq_admin_profit_log UNIQUE (transaction_type, transaction_id)
);

-- Source: supabase/migrations/20260520_results_checker_schema.sql
﻿-- ============================================================================
-- 1. Voucher Types Table (Products)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.results_checker_types (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT UNIQUE NOT NULL,          -- e.g., 'WAEC 2026', 'BECE 2026'
  customer_price DECIMAL(12,2) NOT NULL,
  agent_price    DECIMAL(12,2) NOT NULL,
  cost_price     DECIMAL(12,2) NOT NULL,        -- True supplier cost (used for profit logging)
  is_active      BOOLEAN DEFAULT true,          -- Soft-delete/Archive toggle
  display_order  INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),

  -- Safety check: Selling prices must never be below the cost price
  CONSTRAINT rc_types_pricing_sanity CHECK (customer_price >= cost_price AND agent_price >= cost_price)
);

-- Source: supabase/migrations/20260520_results_checker_schema.sql
-- ============================================================================
-- 2. Voucher Inventory Table (Voucher Codes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.results_checker_inventory (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_id                 UUID NOT NULL REFERENCES public.results_checker_types(id) ON DELETE CASCADE,
  pin                     TEXT NOT NULL,
  serial_number           TEXT NOT NULL,
  status                  TEXT DEFAULT 'available'
                            CHECK (status IN ('available', 'reserved', 'sold')),
  reserved_by_order       UUID,
  reservation_expires_at  TIMESTAMPTZ,
  sold_to_user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sold_at                 TIMESTAMPTZ,
  batch_id                TEXT,
  expiry_date             DATE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type_id, pin)
);

-- Source: supabase/migrations/20260520_results_checker_schema.sql
-- ============================================================================
-- 3. Results Checker Orders Table (Sales Records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.results_checker_orders (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Null for guest purchases
  user_role             TEXT DEFAULT 'customer',
  shop_id               UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL, -- Null if direct platform order
  shop_name             TEXT,
  shop_markup           DECIMAL(12,2) DEFAULT 0,
  customer_name         TEXT,
  customer_email        TEXT,
  customer_phone        TEXT,
  type_id               UUID REFERENCES public.results_checker_types(id),
  type_name             TEXT,                                       -- Snapshotted at purchase time
  quantity              INTEGER NOT NULL CHECK (quantity > 0),
  unit_price            DECIMAL(12,2),                              -- Price paid per voucher
  cost_price_at_time    DECIMAL(12,2),                              -- Supplier cost snapshot for profit audit
  fee_amount            DECIMAL(12,2) DEFAULT 0,                    -- Gateway processing fee
  total_paid            DECIMAL(12,2) NOT NULL,
  merchant_commission   DECIMAL(12,2) DEFAULT 0,
  inventory_ids         UUID[],                                     -- Array of assigned voucher IDs
  status                TEXT DEFAULT 'pending'
                          CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_status        TEXT DEFAULT 'pending'
                          CHECK (payment_status IN ('pending', 'pending_payment', 'completed', 'failed')),
  reference_code        TEXT UNIQUE,
  delivered_via         TEXT[],                                     -- e.g. ['sms', 'email']
  fulfilled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Source: supabase/migrations/20260528_developer_api.sql
-- Developer API: api_keys, api_logs tables + orders table extensions

-- ─── api_keys ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
    id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id      UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    key_hash     TEXT        NOT NULL,
    key_prefix   TEXT        NOT NULL,
    name         TEXT        NOT NULL DEFAULT 'My API Key',
    status       TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'active', 'revoked')),
    rate_limits  JSONB,
    last_used_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT api_keys_user_id_unique UNIQUE (user_id),
    CONSTRAINT api_keys_prefix_unique  UNIQUE (key_prefix)
);

-- Source: supabase/migrations/20260528_developer_api.sql
-- ─── api_logs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_logs (
    id               UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
    api_key_id       UUID        REFERENCES public.api_keys(id) ON DELETE SET NULL,
    user_id          UUID        REFERENCES public.users(id)    ON DELETE SET NULL,
    endpoint         TEXT        NOT NULL,
    method           TEXT        NOT NULL,
    status_code      INTEGER     NOT NULL,
    response_time_ms INTEGER,
    ip_address       TEXT,
    error_message    TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Source: supabase/add_announcements_schema.sql
-- 2. Create shop_announcements table
CREATE TABLE IF NOT EXISTS public.shop_announcements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/add_pricing_approval.sql
-- 3. Create pending pricing table
CREATE TABLE IF NOT EXISTS public.shop_pricing_pending (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES public.data_packages(id) ON DELETE CASCADE NOT NULL,
  selling_price DECIMAL(12, 2) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, package_id)
);

-- Source: supabase/airtime_migration.sql
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

-- Source: supabase/chat_schema.sql
-- Chat conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/chat_schema.sql
-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/push_subscriptions.sql
-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/kqnzmymnjdwfroiixkcy/sql/new

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Source: supabase/shop_schema.sql
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

-- Source: supabase/shop_schema.sql
-- Global Shop Settings (platform-wide defaults)
CREATE TABLE IF NOT EXISTS public.shop_global_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/shop_schema.sql
-- Shop Pricing (custom prices per package per shop)
CREATE TABLE IF NOT EXISTS public.shop_pricing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES public.data_packages(id) ON DELETE CASCADE NOT NULL,
  selling_price DECIMAL(12, 2) NOT NULL,
  UNIQUE(shop_id, package_id)
);

-- Source: supabase/shop_schema.sql
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

-- Source: supabase/shop_schema.sql
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

-- Source: supabase/shop_schema.sql
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
  dakazina_reference TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Source: supabase/shop_withdrawal_improvements.sql
-- 2. Create shop_payment_details table
CREATE TABLE IF NOT EXISTS public.shop_payment_details (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_name    TEXT NOT NULL,
    momo_number     TEXT NOT NULL,
    network         TEXT NOT NULL CHECK (network IN ('MTN MoMo', 'Telecel Cash', 'AirtelTigo Money')),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- ==================================================
-- 4. ALTER COLUMNS
-- ==================================================

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
DO $idempotent_block$
BEGIN
    -- 1. Structural Locks on shop_pricing
ALTER TABLE public.shop_pricing
ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(12,2) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_auto_updated_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DO $idempotent_block$
BEGIN
    -- Add column to snapshot the user's role at time of transaction
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS role_at_time TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DO $idempotent_block$
BEGIN
    -- ============================================================================
-- 2. SHOP_ORDERS TABLE (SHOP PLATFORM)
-- Add snapshot columns for admin true cost and owner role
-- ============================================================================

-- Snapshot of the admin's true supplier cost at the time of the order
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS admin_cost_at_time DECIMAL(12,2);
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DO $idempotent_block$
BEGIN
    -- Snapshot of the shop owner's role at the time of the order
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS owner_role_at_time TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260325_shop_airtime.sql
DO $idempotent_block$
BEGIN
    -- Migration: Add Airtime Fees to Shop Profiles & Adjust RLS
-- Date: 2026-03-25

-- 1. Add airtime fee columns to shop_profiles
ALTER TABLE shop_profiles
ADD COLUMN IF NOT EXISTS airtime_fee_mtn numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS airtime_fee_telecel numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS airtime_fee_at numeric DEFAULT 0;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260325_shop_airtime.sql
DO $idempotent_block$
BEGIN
    -- 3. Add shop tracking to airtime_orders
ALTER TABLE airtime_orders
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shop_profiles(id),
ADD COLUMN IF NOT EXISTS shop_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260328_banner_positioning.sql
DO $idempotent_block$
BEGIN
    -- Add positioning columns for shop banners
ALTER TABLE shop_profiles
ADD COLUMN IF NOT EXISTS banner_pos_x INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS banner_pos_y INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS banner_zoom NUMERIC DEFAULT 1;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260408_add_codecraft_columns.sql
DO $idempotent_block$
BEGIN
    -- Migration: Add CodeCraft fulfillment tracking columns to shop_orders
-- Adds two columns:
--   codecraft_reference_id: stores CodeCraft's returned reference_id after successful placement
--   fulfilled_by: stamps which supplier handled the order ('codecraft' | 'datakazina')

ALTER TABLE public.shop_orders
ADD COLUMN IF NOT EXISTS codecraft_reference_id text,
ADD COLUMN IF NOT EXISTS fulfilled_by text;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- ============================================================================
-- Moolre Withdrawal Integration Schema
-- Adds columns to shop_wallet_transactions and shop_payment_details
-- to support automated MoMo/Bank payouts via Moolre Transfer API.
-- ============================================================================

-- ─── shop_wallet_transactions ────────────────────────────────────────────────

-- Moolre's own internal transaction ID (returned on successful transfer)
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS moolre_transaction_id TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- The externalref we sent to Moolre (= shop_wallet_transactions.id)
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS moolre_external_ref TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Raw txstatus integer from Moolre (1=completed, 0=pending, 2=failed, 3=pending)
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS moolre_status INTEGER;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- 'momo' (default) or 'bank' — determines payment pathway
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'momo';
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Bank sublist ID — only populated for bank transfer withdrawals
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS bank_id TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Bank account number — separated from momo_number for data integrity
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS account_number TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Timestamp when Moolre confirmed the transfer as completed
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- ─── shop_payment_details ─────────────────────────────────────────────────────

-- 'momo' (default) or 'bank'
ALTER TABLE public.shop_payment_details
    ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'momo';
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Bank sublist ID for bank-transfer saved methods
ALTER TABLE public.shop_payment_details
    ADD COLUMN IF NOT EXISTS bank_id TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Bank account number for saved methods
ALTER TABLE public.shop_payment_details
    ADD COLUMN IF NOT EXISTS account_number TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Human-readable bank name, stored at save time so UI doesn't need to re-fetch
ALTER TABLE public.shop_payment_details
    ADD COLUMN IF NOT EXISTS bank_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Human-readable bank name, stored at insert time (looked up server-side from bankId via Moolre cache)
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS bank_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- Optional branch name for bank transfers
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS branch TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_add_kingflexy_columns.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS kingflexy_reference TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_add_kingflexy_columns.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS kingflexy_reference TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    -- ─── Extend orders table ──────────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source       TEXT DEFAULT 'web';
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS api_key_id   UUID REFERENCES public.api_keys(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_dealership_role.sql
DO $idempotent_block$
BEGIN
    -- Add dealer tracking columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS dealer_claimed_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_dealership_role.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS dealer_expires_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_dealership_role.sql
DO $idempotent_block$
BEGIN
    -- Add dealer_price column to data_packages
ALTER TABLE data_packages ADD COLUMN IF NOT EXISTS dealer_price DECIMAL(10,2);
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260530_dealer_pricing_extensions.sql
DO $idempotent_block$
BEGIN
    -- Add dealer_price to results_checker_types
ALTER TABLE results_checker_types ADD COLUMN IF NOT EXISTS dealer_price DECIMAL(10,2) DEFAULT 0;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_date_of_birth.sql
DO $idempotent_block$
BEGIN
    -- Add date_of_birth column to existing table
ALTER TABLE public.afa_orders ADD COLUMN IF NOT EXISTS date_of_birth DATE;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_id_type_and_payment.sql
DO $idempotent_block$
BEGIN
    -- Migration: MTN AFA Registration Enhancements
-- Adds id_type, id_number, and payment_amount columns to afa_orders
-- Run this in your Supabase SQL Editor

-- Add id_type column (Ghana Card, Passport, Driver's License, Voter ID)
ALTER TABLE public.afa_orders
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(12, 2) DEFAULT 0.00;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_order_rpc.sql
DO $idempotent_block$
BEGIN
    -- ============================================================
-- AFA Order Processing: Schema Upgrades + Atomic RPC
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1A: Add metadata column to wallet_transactions
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS metadata JSONB;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_order_rpc.sql
DO $idempotent_block$
BEGIN
    -- ────────────────────────────────────────────────────────────
-- STEP 1C: Upgrade afa_orders table
-- ────────────────────────────────────────────────────────────

-- Add reference_code (nullable first — safe for existing rows)
ALTER TABLE public.afa_orders
    ADD COLUMN IF NOT EXISTS reference_code TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_order_rpc.sql
DO $idempotent_block$
BEGIN
    -- Add transaction_id foreign key link to financial ledger
ALTER TABLE public.afa_orders
    ADD COLUMN IF NOT EXISTS transaction_id UUID
    REFERENCES public.wallet_transactions(id);
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_agent_expires_at.sql
DO $idempotent_block$
BEGIN
    -- Add agent_expires_at column to users table
-- This column tracks when an agent's access expires

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS agent_expires_at TIMESTAMP WITH TIME ZONE;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_announcements_schema.sql
DO $idempotent_block$
BEGIN
    -- Migration to add missing announcement features

-- 1. Update system_announcements table
-- Add visible_on column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_announcements' AND column_name = 'visible_on') THEN
        ALTER TABLE public.system_announcements ADD COLUMN visible_on TEXT DEFAULT 'main_site' CHECK (visible_on IN ('main_site', 'storefronts', 'both'));
    END IF;
END $$;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    -- ============================================================
-- Two-Stage Pricing Approval Migration (Safe Re-run Version)
-- ============================================================

-- 1. Add columns (IF NOT EXISTS handles already-added columns)
ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_status TEXT DEFAULT 'not_submitted';
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_note TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_rejection_acknowledged BOOLEAN DEFAULT true;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_submitted_at TIMESTAMP WITH TIME ZONE;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_approved_at TIMESTAMP WITH TIME ZONE;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS pricing_approved_by UUID REFERENCES public.users(id);
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_shop_name_to_orders.sql
DO $idempotent_block$
BEGIN
    -- Migration: Add shop_name to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_shop_order_id_to_orders.sql
DO $idempotent_block$
BEGIN
    -- Migration: Add shop_order_id to orders table for robust syncing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_order_id UUID REFERENCES public.shop_orders(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_withdrawal_rls_and_name.sql
DO $idempotent_block$
BEGIN
    -- 1. Add account_name column to shop_wallet_transactions
ALTER TABLE public.shop_wallet_transactions
ADD COLUMN IF NOT EXISTS account_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_withdrawal_improvements.sql
DO $idempotent_block$
BEGIN
    -- ============================================================
-- Shop Withdrawal Improvements Migration
-- Adds: shop_payment_details table, network + balance_snapshot
--       columns to shop_wallet_transactions
-- ============================================================

-- 1. Add new columns to shop_wallet_transactions
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS network TEXT,
    ADD COLUMN IF NOT EXISTS balance_snapshot NUMERIC(12, 2);
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;



-- ==================================================
-- 5. CONSTRAINTS
-- ==================================================

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_profit_margin_range') THEN
        ALTER TABLE public.shop_pricing ADD CONSTRAINT check_profit_margin_range CHECK (profit_margin > 0 AND profit_margin <= 10);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_shop_package') THEN
        ALTER TABLE public.shop_pricing ADD CONSTRAINT unique_shop_package UNIQUE (shop_id, package_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_wallet_transactions_status_check') THEN
        ALTER TABLE public.shop_wallet_transactions
    ADD CONSTRAINT shop_wallet_transactions_status_check
    CHECK (status IN ('pending', 'moolre_pending', 'completed'));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_add_kingflexy_fulfillment_method.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_method_check') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_method_check
  CHECK (fulfillment_method IN ('auto', 'manual', 'codecraft', 'datakazina', 'kingflexy'));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_dealership_role.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'agent', 'admin', 'sub-admin', 'dealer'));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_order_rpc.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'afa_orders_reference_code_unique') THEN
        ALTER TABLE public.afa_orders
    ADD CONSTRAINT afa_orders_reference_code_unique UNIQUE (reference_code);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_profiles_pricing_status_check') THEN
        -- 2. Add CHECK constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shop_profiles_pricing_status_check'
  ) THEN
    ALTER TABLE public.shop_profiles
      ADD CONSTRAINT shop_profiles_pricing_status_check
      CHECK (pricing_status IN ('not_submitted', 'pending_review', 'approved', 'rejected'));
  END IF;
END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_shop_order_fk.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_shop_wallet_transactions_shop_order') THEN
        -- Migration to add missing foreign key constraint for shop_order_id

ALTER TABLE public.shop_wallet_transactions
ADD CONSTRAINT fk_shop_wallet_transactions_shop_order
FOREIGN KEY (shop_order_id)
REFERENCES public.shop_orders(id)
ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migration_fix_roles.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        -- Step 5: Add new constraint with all valid roles (after data is cleaned)
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'agent', 'sub-admin', 'admin'));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;



-- ==================================================
-- 6. INDEXES
-- ==================================================

-- Source: supabase/schema.sql
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON public.complaints(user_id);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Source: supabase/schema.sql
CREATE INDEX IF NOT EXISTS idx_users_agent_expires_at ON public.users(agent_expires_at);

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shop_pricing_package ON public.shop_pricing(package_id);

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
CREATE INDEX IF NOT EXISTS idx_shop_pricing_shop ON public.shop_pricing(shop_id);

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
-- Indexes for performance and auditing visibility
CREATE INDEX IF NOT EXISTS idx_profit_logs_type ON public.admin_profit_logs(transaction_type);

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
CREATE INDEX IF NOT EXISTS idx_profit_logs_loss ON public.admin_profit_logs(is_loss) WHERE is_loss = true;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
CREATE INDEX IF NOT EXISTS idx_profit_logs_created ON public.admin_profit_logs(created_at DESC);

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
-- Index completed statuses for fast RPC analytical queries
CREATE INDEX IF NOT EXISTS idx_orders_completed ON public.orders(created_at DESC) WHERE status = 'completed';

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_orders_completed ON public.shop_orders(created_at DESC) WHERE status = 'completed';

-- Source: supabase/migrations/20260408_add_codecraft_columns.sql
-- Optional: index fulfilled_by for admin dashboard queries filtering by supplier
CREATE INDEX IF NOT EXISTS idx_shop_orders_fulfilled_by ON public.shop_orders (fulfilled_by);

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
-- ─── Indexes for cron performance ────────────────────────────────────────────
-- Cron job queries exclusively on moolre_pending — make it fast
CREATE INDEX IF NOT EXISTS idx_shop_wallet_tx_moolre_pending
    ON public.shop_wallet_transactions (status)
    WHERE status = 'moolre_pending';

-- Source: supabase/migrations/20260520_results_checker_schema.sql
CREATE INDEX IF NOT EXISTS idx_rc_types_active
  ON public.results_checker_types(display_order)
  WHERE is_active = true;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
-- Optimize FIFO searches for available stock
CREATE INDEX IF NOT EXISTS idx_rc_inv_available
  ON public.results_checker_inventory(type_id, created_at ASC)
  WHERE status = 'available';

-- Source: supabase/migrations/20260520_results_checker_schema.sql
-- Optimize reservation cleanups
CREATE INDEX IF NOT EXISTS idx_rc_inv_reserved_expiry
  ON public.results_checker_inventory(reservation_expires_at)
  WHERE status = 'reserved';

-- Source: supabase/migrations/20260520_results_checker_schema.sql
CREATE INDEX IF NOT EXISTS idx_rc_inv_type_status
  ON public.results_checker_inventory(type_id, status);

-- Source: supabase/migrations/20260520_results_checker_schema.sql
CREATE INDEX IF NOT EXISTS idx_rc_orders_user ON public.results_checker_orders(user_id);

-- Source: supabase/migrations/20260520_results_checker_schema.sql
CREATE INDEX IF NOT EXISTS idx_rc_orders_status ON public.results_checker_orders(status, payment_status);

-- Source: supabase/migrations/20260520_results_checker_schema.sql
CREATE INDEX IF NOT EXISTS idx_rc_orders_ref ON public.results_checker_orders(reference_code);

-- Source: supabase/migrations/20260520_results_checker_schema.sql
CREATE INDEX IF NOT EXISTS idx_rc_orders_shop ON public.results_checker_orders(shop_id);

-- Source: supabase/migrations/20260520_results_checker_schema.sql
CREATE INDEX IF NOT EXISTS idx_rc_orders_created ON public.results_checker_orders(created_at DESC);

-- Source: supabase/migrations/20260528_developer_api.sql
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

-- Source: supabase/migrations/20260528_developer_api.sql
CREATE INDEX IF NOT EXISTS idx_api_keys_status  ON public.api_keys(status);

-- Source: supabase/migrations/20260528_developer_api.sql
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix  ON public.api_keys(key_prefix);

-- Source: supabase/migrations/20260528_developer_api.sql
CREATE INDEX IF NOT EXISTS idx_api_logs_api_key_id ON public.api_logs(api_key_id);

-- Source: supabase/migrations/20260528_developer_api.sql
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id    ON public.api_logs(user_id);

-- Source: supabase/migrations/20260528_developer_api.sql
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs(created_at DESC);

-- Source: supabase/migrations/20260528_developer_api.sql
CREATE INDEX IF NOT EXISTS idx_orders_source     ON public.orders(source);

-- Source: supabase/migrations/20260528_developer_api.sql
CREATE INDEX IF NOT EXISTS idx_orders_api_key_id ON public.orders(api_key_id);

-- Source: supabase/add_afa_order_rpc.sql
-- ────────────────────────────────────────────────────────────
-- STEP 1B: Performance index on metadata category
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_category
    ON public.wallet_transactions ((metadata->>'category'));

-- Source: supabase/add_shop_name_to_orders.sql
-- Create index for easier filtering
CREATE INDEX IF NOT EXISTS idx_orders_shop_name ON public.orders(shop_name) WHERE shop_name IS NOT NULL;

-- Source: supabase/add_shop_order_id_to_orders.sql
-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_shop_order_id ON public.orders(shop_order_id) WHERE shop_order_id IS NOT NULL;

-- Source: supabase/airtime_migration.sql
-- Indexes
CREATE INDEX IF NOT EXISTS idx_airtime_orders_user_id ON public.airtime_orders(user_id);

-- Source: supabase/airtime_migration.sql
CREATE INDEX IF NOT EXISTS idx_airtime_orders_status ON public.airtime_orders(status);

-- Source: supabase/airtime_migration.sql
CREATE INDEX IF NOT EXISTS idx_airtime_orders_created_at ON public.airtime_orders(created_at DESC);

-- Source: supabase/airtime_migration.sql
CREATE INDEX IF NOT EXISTS idx_airtime_orders_reference ON public.airtime_orders(reference_code);

-- Source: supabase/airtime_migration.sql
CREATE INDEX IF NOT EXISTS idx_airtime_orders_beneficiary_phone ON public.airtime_orders(beneficiary_phone);

-- Source: supabase/chat_schema.sql
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_agent ON public.chat_conversations(agent_id);

-- Source: supabase/chat_schema.sql
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON public.chat_conversations(status);

-- Source: supabase/chat_schema.sql
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON public.chat_conversations(last_message_at DESC);

-- Source: supabase/chat_schema.sql
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);

-- Source: supabase/chat_schema.sql
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);

-- Source: supabase/chat_schema.sql
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);

-- Source: supabase/chat_schema.sql
CREATE INDEX IF NOT EXISTS idx_chat_messages_read ON public.chat_messages(read) WHERE read = false;

-- Source: supabase/shop_schema.sql
-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shop_profiles_slug ON public.shop_profiles(shop_slug);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_profiles_owner ON public.shop_profiles(owner_id);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_profiles_status ON public.shop_profiles(approval_status);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_orders_shop ON public.shop_orders(shop_id);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_orders_guest_phone ON public.shop_orders(guest_phone);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_orders_reference ON public.shop_orders(paystack_reference);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders(status);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_orders_created ON public.shop_orders(created_at DESC);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_wallet_transactions_wallet ON public.shop_wallet_transactions(shop_wallet_id);

-- Source: supabase/shop_schema.sql
CREATE INDEX IF NOT EXISTS idx_shop_announcements_shop ON public.shop_announcements(shop_id);



-- ==================================================
-- 7. FUNCTIONS
-- ==================================================

-- Source: supabase/fix_security_warnings.sql
-- ----------------------------------------------------------------------------
-- Fix handle_new_user_wallet() function
-- This function auto-creates wallet when new user is created
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Source: supabase/migrations/20260422_security_hardening_p0.sql
-- ============================================================================
-- SECURITY HARDENING — P0 CRITICAL FIXES
-- Date: 2026-04-22
-- Covers: DEEP-01 (credit_wallet_balance unguarded) + ERROR-01 (afa_registrations SECURITY DEFINER view)
-- ============================================================================

-- ============================================================================
-- P0 FIX 1 — DEEP-01: Guard credit_wallet_balance against unauthorized calls
-- Without this guard, ANY authenticated user can call this RPC to credit
-- any wallet with any amount — an infinite money exploit.
-- Fix: Require service_role JWT claim. Uses canonical Supabase claims parsing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.credit_wallet_balance(
  p_user_id uuid,
  p_amount  numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jwt_role TEXT;
BEGIN
  -- SECURITY: Only callable by server-side service role.
  -- Uses canonical Supabase JWT claims JSON (not legacy dot-notation which can return NULL).
  v_jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    ''
  );

  IF v_jwt_role != 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: credit_wallet_balance requires service_role';
  END IF;

  -- Guard: reject zero or negative amounts
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: amount must be positive';
  END IF;

  UPDATE public.wallets
  SET
    balance     = balance + p_amount,
    total_spent = GREATEST(0, COALESCE(total_spent, 0) - p_amount),
    updated_at  = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Source: supabase/migrations/20260219_atomic_wallet_deduction.sql
-- ============================================================
-- Atomic Wallet Deduction RPC
-- Prevents double-spend race conditions by combining
-- balance check and deduction into a single atomic operation.
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_wallet_balance(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE(
    wallet_id UUID,
    new_balance NUMERIC,
    new_total_spent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
    v_new_balance NUMERIC;
    v_new_total_spent NUMERIC;
BEGIN
    -- Atomic: UPDATE with WHERE balance >= amount
    -- If balance is insufficient, no rows are updated.
    UPDATE wallets
    SET
        balance = balance - p_amount,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND balance >= p_amount
    RETURNING id, balance, COALESCE(total_spent, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_spent;

    -- If no row was updated, the balance was insufficient
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_spent;
END;
$$;

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
-- 3. Trigger 1: Protect selling_price, cost_price & profit_margin
CREATE OR REPLACE FUNCTION protect_shop_pricing_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Lock profit_margin from ever being changed after creation
    IF NEW.profit_margin != OLD.profit_margin THEN
        RAISE EXCEPTION 'profit_margin cannot be changed after creation';
    END IF;

    -- Note: cost_price and selling_price protection is removed
    -- as cost_price does not exist on this table and selling_price
    -- calculation is managed by the data_packages trigger.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
-- 4. Trigger 2: Auto Update on Platform Price Change (CTE + Audit log + Rollback flag guard)
CREATE OR REPLACE FUNCTION auto_update_shop_pricing_on_platform_cost()
RETURNS TRIGGER AS $$
BEGIN
    -- Zero Price Guard
    IF NEW.price <= 0 OR (NEW.agent_price IS NOT NULL AND NEW.agent_price <= 0) THEN
        RAISE EXCEPTION 'Invalid platform price detected';
    END IF;

    -- Trigger Guard (Loops, No Operation)
    IF NEW.price IS NOT DISTINCT FROM OLD.price AND NEW.agent_price IS NOT DISTINCT FROM OLD.agent_price THEN
        RETURN NEW;
    END IF;

    -- Safe execution block guaranteeing flag reset
    BEGIN
        -- System Isolation bypass flag
        PERFORM set_config('app.system_pricing_update', 'true', true);

        WITH updated_pricing AS (
            SELECT
                sp.id,
                sp.shop_id,
                sp.package_id,
                CASE
                    WHEN u.role = 'agent' AND OLD.agent_price IS NOT NULL THEN OLD.agent_price
                    ELSE OLD.price
                END AS old_cost,
                sp.selling_price AS old_selling,
                CASE
                    WHEN u.role = 'agent' AND NEW.agent_price IS NOT NULL THEN NEW.agent_price
                    ELSE NEW.price
                END AS new_cost,
                (
                    CASE
                        WHEN u.role = 'agent' AND NEW.agent_price IS NOT NULL THEN NEW.agent_price
                        ELSE NEW.price
                    END
                ) + (
                    CASE
                        WHEN sp.profit_margin <= 0 THEN 1
                        WHEN sp.profit_margin > 10 THEN 10
                        ELSE sp.profit_margin
                    END
                ) AS new_selling
            FROM public.shop_pricing sp
            JOIN public.shop_profiles spf ON sp.shop_id = spf.id
            JOIN public.users u ON u.id = spf.owner_id
            WHERE sp.package_id = NEW.id
        ),
        applied_update AS (
            UPDATE public.shop_pricing sp
            SET
                selling_price = up.new_selling,
                last_auto_updated_at = NOW()
            FROM updated_pricing up
            WHERE sp.id = up.id
            RETURNING up.*
        )
        INSERT INTO public.shop_pricing_logs (
            shop_id, package_id, old_cost_price, new_cost_price,
            old_selling_price, new_selling_price, changed_at
        )
        SELECT
            shop_id, package_id, old_cost, new_cost,
            old_selling, new_selling, NOW()
        FROM applied_update;

        PERFORM set_config('app.system_pricing_update', 'false', true);
        RETURN NEW;
    EXCEPTION
        WHEN OTHERS THEN
            PERFORM set_config('app.system_pricing_update', 'false', true);
            RAISE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
-- ============================================================================
-- 4. POSTGRES TRIGGERS (AUTOMATED INSERTION FOR ADMIN_PROFIT_LOGS)
-- Triggers ONLY when status transitions to 'completed'
-- ============================================================================

-- Trigger for MAIN platform
CREATE OR REPLACE FUNCTION public.log_main_profit() RETURNS TRIGGER AS $$
BEGIN
  -- Strict checking: ONLY on transition to 'completed' with valid cost constraint
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.cost_price_at_time > 0 AND NEW.shop_order_id IS NULL
  THEN
    -- Prevent Duplicate Inserts explicitly
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_profit_logs
      WHERE transaction_type = 'main' AND transaction_id = NEW.id
    ) THEN
        INSERT INTO public.admin_profit_logs (
          transaction_type, transaction_id, channel, role_at_time,
          selling_price, admin_cost, profit, calculation_note
        ) VALUES (
          'main', NEW.id, 'main', NEW.role_at_time,
          NEW.price, NEW.cost_price_at_time, NEW.price - NEW.cost_price_at_time,
          format('Main order: %s (selling) - %s (cost) = %s %s | role: %s',
            NEW.price, NEW.cost_price_at_time, NEW.price - NEW.cost_price_at_time,
            CASE WHEN (NEW.price - NEW.cost_price_at_time) < 0 THEN 'LOSS' ELSE 'PROFIT' END,
            COALESCE(NEW.role_at_time, 'unknown'))
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
-- Trigger for SHOP platform
CREATE OR REPLACE FUNCTION public.log_shop_profit() RETURNS TRIGGER AS $$
BEGIN
  -- Strict checking: ONLY on transition to 'completed' with valid admin cost
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.admin_cost_at_time IS NOT NULL AND NEW.admin_cost_at_time > 0
  THEN
    -- Prevent Duplicate Inserts Explicitly
    IF NOT EXISTS (
       SELECT 1 FROM public.admin_profit_logs
       WHERE transaction_type = 'shop' AND transaction_id = NEW.id
    ) THEN
        INSERT INTO public.admin_profit_logs (
          transaction_type, transaction_id, channel, role_at_time,
          amount_paid_to_admin, admin_cost, profit, calculation_note
        ) VALUES (
          'shop', NEW.id, 'shop', NEW.owner_role_at_time,
          NEW.cost_price, NEW.admin_cost_at_time, NEW.cost_price - NEW.admin_cost_at_time,
          format('Shop order: %s (owner paid) - %s (admin cost) = %s %s | role: %s',
            NEW.cost_price, NEW.admin_cost_at_time, NEW.cost_price - NEW.admin_cost_at_time,
            CASE WHEN (NEW.cost_price - NEW.admin_cost_at_time) < 0 THEN 'LOSS' ELSE 'PROFIT' END,
            COALESCE(NEW.owner_role_at_time, 'unknown'))
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: supabase/migrations/20260318_profit_rpcs.sql
-- ============================================================================
-- get_profit_summary
-- Calculates revenue, cost, profit, growth for defined period
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_profit_summary(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_prev_start_date TIMESTAMP WITH TIME ZONE,
    p_prev_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Current Period
    v_main_revenue DECIMAL := 0;
    v_main_cost DECIMAL := 0;
    v_main_orders INT := 0;
    v_main_excluded INT := 0;

    v_shop_revenue DECIMAL := 0;
    v_shop_platform_cost DECIMAL := 0;
    v_shop_owner_profit_sum DECIMAL := 0;
    v_shop_orders INT := 0;
    v_shop_excluded INT := 0;

    -- Previous Period (for Growth)
    v_prev_main_profit DECIMAL := 0;
    v_prev_shop_platform_profit DECIMAL := 0;

    -- Totals
    v_total_revenue DECIMAL;
    v_total_cost DECIMAL;
    v_total_profit DECIMAL;
    v_profit_margin DECIMAL := 0;
    v_growth_pct DECIMAL := 0;
BEGIN
    -- MAIN: Current Period (Only Completed, Valid Cost)
    SELECT
        COALESCE(SUM(price), 0),
        COALESCE(SUM(cost_price_at_time), 0),
        COUNT(id)
    INTO v_main_revenue, v_main_cost, v_main_orders
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- MAIN: Excluded Orders
    SELECT COUNT(id) INTO v_main_excluded
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND (cost_price_at_time IS NULL OR cost_price_at_time <= 0)
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- SHOP: Current Period
    SELECT
        COALESCE(SUM(cost_price), 0),          -- What platform earned
        COALESCE(SUM(admin_cost_at_time), 0),  -- Platform's true cost
        COALESCE(SUM(profit), 0),              -- Owner's cut
        COUNT(id)
    INTO v_shop_revenue, v_shop_platform_cost, v_shop_owner_profit_sum, v_shop_orders
    FROM public.shop_orders
    WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- SHOP: Excluded Orders
    SELECT COUNT(id) INTO v_shop_excluded
    FROM public.shop_orders
    WHERE status = 'completed' AND (admin_cost_at_time IS NULL OR admin_cost_at_time <= 0)
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- PREVIOUS PERIOD (For Growth calculation)
    SELECT COALESCE(SUM(price - cost_price_at_time), 0) INTO v_prev_main_profit
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
    AND created_at BETWEEN p_prev_start_date AND p_prev_end_date;

    SELECT COALESCE(SUM(cost_price - admin_cost_at_time), 0) INTO v_prev_shop_platform_profit
    FROM public.shop_orders
    WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    AND created_at BETWEEN p_prev_start_date AND p_prev_end_date;

    -- Compute Totals
    v_total_revenue := v_main_revenue + v_shop_revenue;
    v_total_cost := v_main_cost + v_shop_platform_cost;
    v_total_profit := (v_main_revenue - v_main_cost) + (v_shop_revenue - v_shop_platform_cost);

    IF v_total_revenue > 0 THEN
        v_profit_margin := ROUND((v_total_profit / v_total_revenue) * 100, 2);
    END IF;

    -- Compute Growth
    DECLARE
        v_prev_total_profit DECIMAL := v_prev_main_profit + v_prev_shop_platform_profit;
    BEGIN
        IF v_prev_total_profit > 0 THEN
            v_growth_pct := ROUND(((v_total_profit - v_prev_total_profit) / v_prev_total_profit) * 100, 2);
        ELSIF v_total_profit > 0 THEN
            v_growth_pct := 100;
        END IF;
    END;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'total_revenue', v_total_revenue,
            'total_cost', v_total_cost,
            'total_profit', v_total_profit,
            'profit_margin', v_profit_margin,
            'total_orders', v_main_orders + v_shop_orders,
            'excluded_orders', v_main_excluded + v_shop_excluded,
            'growth_percent', v_growth_pct
        ),
        'main_stats', jsonb_build_object(
            'revenue', v_main_revenue,
            'cost', v_main_cost,
            'profit', v_main_revenue - v_main_cost,
            'orders', v_main_orders
        ),
        'shop_stats', jsonb_build_object(
            'revenue', v_shop_revenue,
            'platform_cost', v_shop_platform_cost,
            'platform_profit', v_shop_revenue - v_shop_platform_cost,
            'owner_profit', v_shop_owner_profit_sum,
            'orders', v_shop_orders
        )
    );
END;
$$;

-- Source: supabase/migrations/20260318_profit_rpcs.sql
-- ============================================================================
-- get_profit_timeseries
-- Pre-aggregates daily results to feed charts without huge payloads
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_profit_timeseries(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH dates AS (
        SELECT generate_series(
            p_start_date::date,
            p_end_date::date,
            '1 day'::interval
        )::date AS day
    ),
    main_daily AS (
        SELECT
            DATE(created_at) as day,
            SUM(price) as main_rev,
            SUM(price - cost_price_at_time) as main_profit
        FROM public.orders
        WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
    ),
    shop_daily AS (
        SELECT
            DATE(created_at) as day,
            SUM(cost_price) as shop_rev,
            SUM(cost_price - admin_cost_at_time) as shop_platform_profit,
            SUM(profit) as shop_owner_profit
        FROM public.shop_orders
        WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', TO_CHAR(d.day, 'YYYY-MM-DD'),
            'main_revenue', COALESCE(m.main_rev, 0),
            'main_profit', COALESCE(m.main_profit, 0),
            'shop_revenue', COALESCE(s.shop_rev, 0),
            'shop_platform_profit', COALESCE(s.shop_platform_profit, 0),
            'shop_owner_profit', COALESCE(s.shop_owner_profit, 0)
        ) ORDER BY d.day ASC
    ), '[]'::jsonb) INTO v_result
    FROM dates d
    LEFT JOIN main_daily m ON m.day = d.day
    LEFT JOIN shop_daily s ON s.day = d.day;

    RETURN v_result;
END;
$$;

-- Source: supabase/migrations/20260318_profit_rpcs.sql
-- ============================================================================
-- get_shop_owner_stats
-- Analytical view of top shop owners
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_shop_owner_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'owner_id', u.id,
            'owner_name', COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
            'shop_name', sp.shop_name,
            'total_sales_count', COALESCE(stats.sales_count, 0),
            'total_sales_value', COALESCE(stats.sales_value, 0),
            'platform_profit', COALESCE(stats.plat_profit, 0),
            'owner_profit', COALESCE(stats.own_profit, 0),
            'wallet_balance', COALESCE(sw.balance, 0)
        ) ORDER BY stats.own_profit DESC NULLS LAST
    ), '[]'::jsonb) INTO v_result
    FROM public.shop_profiles sp
    JOIN public.users u ON u.id = sp.owner_id
    LEFT JOIN public.shop_wallets sw ON sw.owner_id = sp.owner_id
    LEFT JOIN LATERAL (
        SELECT
            COUNT(id) as sales_count,
            SUM(selling_price) as sales_value,
            SUM(cost_price - admin_cost_at_time) as plat_profit,
            SUM(profit) as own_profit
        FROM public.shop_orders
        WHERE shop_id = sp.id AND status = 'completed'
          AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    ) stats ON true;

    RETURN v_result;
END;
$$;

-- Source: supabase/migrations/20260318_profit_rpcs.sql
-- ============================================================================
-- get_wallet_overview
-- Aggregate overall wallet metrics vs derived profit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_wallet_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_bal DECIMAL := 0;
    v_user_count INT := 0;
    v_shop_bal DECIMAL := 0;
    v_shop_count INT := 0;
BEGIN
    -- Regular User Wallets (Exclude Admins if preferred, or include all valid users)
    SELECT COALESCE(SUM(w.balance), 0), COUNT(w.id)
    INTO v_user_bal, v_user_count
    FROM public.wallets w
    JOIN public.users u ON u.id = w.user_id
    WHERE u.role NOT IN ('admin', 'sub-admin') AND w.balance > 0;

    -- Shop Owner Wallets
    SELECT COALESCE(SUM(balance), 0), COUNT(id)
    INTO v_shop_bal, v_shop_count
    FROM public.shop_wallets
    WHERE balance > 0;

    RETURN jsonb_build_object(
        'total_user_balance', v_user_bal,
        'user_count', v_user_count,
        'total_shop_owner_balance', v_shop_bal,
        'shop_owner_count', v_shop_count
    );
END;
$$;

-- Source: supabase/migrations/20260422_security_hardening_deep02.sql
-- ============================================================================
-- SECURITY HARDENING — DEEP-02 FIX
-- Date: 2026-04-22
-- Covers: Atomic RPC for wallet top-ups to fix read-then-write race condition
-- ============================================================================

CREATE OR REPLACE FUNCTION public.topup_wallet_balance(
  p_user_id uuid,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jwt_role TEXT;
  v_new_balance numeric;
BEGIN
  -- SECURITY: Only callable by server-side service role.
  v_jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    ''
  );

  IF v_jwt_role != 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: topup_wallet_balance requires service_role';
  END IF;

  -- Guard: reject zero or negative amounts
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: amount must be positive';
  END IF;

  UPDATE public.wallets
  SET
    balance = balance + p_amount,
    total_credited = COALESCE(total_credited, 0) + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- Source: supabase/migrations/20260425_shop_wallet_rpc.sql
-- ============================================================
-- Atomic Shop Wallet Deduction RPC
-- Prevents double-spend race conditions for shop owners.
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_shop_wallet_balance(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE(
    wallet_id UUID,
    new_balance NUMERIC,
    new_total_withdrawn NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    -- Use ALIAS FOR positional args to avoid parameter resolution issues
    -- with SECURITY DEFINER + empty search_path
    _user_id  ALIAS FOR $1;
    _amount   ALIAS FOR $2;
    v_wallet_id           UUID;
    v_new_balance         NUMERIC;
    v_new_total_withdrawn NUMERIC;
BEGIN
    -- Atomic: UPDATE with WHERE balance >= amount (single statement = no race condition)
    UPDATE public.shop_wallets
    SET
        balance          = balance - _amount,
        total_withdrawn  = COALESCE(total_withdrawn, 0) + _amount,
        updated_at       = NOW()
    WHERE owner_id = _user_id
      AND balance   >= _amount
    RETURNING id, balance, COALESCE(total_withdrawn, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_withdrawn;

    -- If no row was updated, the balance was insufficient
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_withdrawn;
END;
$$;

-- Source: supabase/migrations/20260425_shop_wallet_rpc.sql
-- ============================================================
-- Atomic Shop Wallet Credit RPC
-- Used to revert a deduction if transaction insertion fails
-- ============================================================

CREATE OR REPLACE FUNCTION credit_shop_wallet_balance(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE(
    wallet_id UUID,
    new_balance NUMERIC,
    new_total_withdrawn NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _user_id  ALIAS FOR $1;
    _amount   ALIAS FOR $2;
    v_wallet_id           UUID;
    v_new_balance         NUMERIC;
    v_new_total_withdrawn NUMERIC;
BEGIN
    -- Atomic: UPDATE to add balance back and subtract from total_withdrawn
    UPDATE public.shop_wallets
    SET
        balance         = balance + _amount,
        total_withdrawn = COALESCE(total_withdrawn, 0) - _amount,
        updated_at      = NOW()
    WHERE owner_id = _user_id
    RETURNING id, balance, COALESCE(total_withdrawn, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_withdrawn;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_withdrawn;
END;
$$;

-- Source: supabase/migrations/20260508_public_safe_settings_and_shop_lookup.sql
create or replace function public.get_shop_order_by_phone_reference(
  phone_number text,
  order_reference text
)
returns table (
  id uuid,
  network text,
  package_size text,
  selling_price numeric,
  status text,
  created_at timestamptz,
  shop_name text,
  shop_slug text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    so.id,
    so.network,
    so.package_size,
    so.selling_price,
    so.status,
    so.created_at,
    sp.shop_name,
    sp.shop_slug
  from public.shop_orders so
  join public.shop_profiles sp on so.shop_id = sp.id
  where so.guest_phone = phone_number
    and so.paystack_reference = order_reference
    and so.created_at >= now() - interval '48 hours'
  order by so.created_at desc
  limit 1;
end;
$$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
-- ============================================================================
-- 5. RPC: assign_results_checker_vouchers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_results_checker_vouchers(
  p_type_id  UUID,
  p_quantity INTEGER,
  p_order_id UUID
)
RETURNS TABLE (
  id            UUID,
  pin           TEXT,
  serial_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_timeout_minutes INTEGER := 10;
  v_timeout_setting TEXT;
  v_reserved_count  INTEGER;
BEGIN
  -- Read reservation timeout from settings table (fallback to 10 mins)
  SELECT value INTO v_timeout_setting
  FROM public.admin_settings
  WHERE key = 'results_checker_reservation_timeout';

  IF v_timeout_setting IS NOT NULL THEN
    v_timeout_minutes := v_timeout_setting::INTEGER;
  END IF;

  -- Step 1: Select and lock available vouchers using FIFO (First In, First Out)
  RETURN QUERY
  WITH selected AS (
    SELECT inv.id
    FROM public.results_checker_inventory inv
    WHERE inv.type_id = p_type_id
      AND inv.status = 'available'
    ORDER BY inv.created_at ASC
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  ),
  -- Step 2: Transition the locked records to 'reserved' state
  updated AS (
    UPDATE public.results_checker_inventory inv
    SET
      status                 = 'reserved',
      reserved_by_order      = p_order_id,
      reservation_expires_at = NOW() + (v_timeout_minutes || ' minutes')::INTERVAL,
      updated_at             = NOW()
    FROM selected
    WHERE inv.id = selected.id
    RETURNING inv.id, inv.pin, inv.serial_number
  )
  SELECT * FROM updated;

  -- Step 3: Verify the exact quantity was locked successfully
  GET DIAGNOSTICS v_reserved_count = ROW_COUNT;

  IF v_reserved_count < p_quantity THEN
    -- Roll back partial lock if count fails to meet target quantity
    UPDATE public.results_checker_inventory
    SET
      status                 = 'available',
      reserved_by_order      = NULL,
      reservation_expires_at = NULL,
      updated_at             = NOW()
    WHERE reserved_by_order = p_order_id;

    RAISE EXCEPTION 'INSUFFICIENT_INVENTORY';
  END IF;
END;
$$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
-- ============================================================================
-- 6. RPC: finalize_results_checker_sale
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finalize_results_checker_sale(
  p_order_id UUID,
  p_user_id  UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.results_checker_inventory
  SET
    status                 = 'sold',
    reserved_by_order      = NULL,
    reservation_expires_at = NULL,
    sold_to_user_id        = p_user_id,
    sold_at                = NOW(),
    updated_at             = NOW()
  WHERE reserved_by_order = p_order_id
    AND status = 'reserved';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
-- ============================================================================
-- 7. RPC: release_expired_rc_reservations
-- ============================================================================
CREATE OR REPLACE FUNCTION public.release_expired_rc_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.results_checker_inventory
  SET
    status                 = 'available',
    reserved_by_order      = NULL,
    reservation_expires_at = NULL,
    updated_at             = NOW()
  WHERE status = 'reserved'
    AND reservation_expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Source: supabase/add_afa_order_rpc.sql
-- ────────────────────────────────────────────────────────────
-- STEP 1D: Atomic RPC — process_afa_order
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_afa_order(
    p_user_id       UUID,
    p_amount        NUMERIC,
    p_form_data     JSONB,
    p_reference_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id      UUID;
    v_wallet_balance NUMERIC;
    v_new_balance    NUMERIC;
    v_transaction_id UUID;
    v_order_id       UUID;
BEGIN
    -- Step 1: Lock the wallet row to prevent race conditions
    SELECT id, balance
        INTO v_wallet_id, v_wallet_balance
        FROM public.wallets
        WHERE user_id = p_user_id
        FOR UPDATE;

    -- Step 2: Validate balance
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    IF v_wallet_balance < p_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    -- Step 3: Deduct wallet balance
    UPDATE public.wallets
        SET
            balance     = balance - p_amount,
            total_spent = COALESCE(total_spent, 0) + p_amount,
            updated_at  = NOW()
        WHERE id = v_wallet_id
        RETURNING balance INTO v_new_balance;

    -- Step 4: Insert wallet transaction record (visible in user history + admin finance)
    INSERT INTO public.wallet_transactions (
        wallet_id,
        user_id,
        type,
        amount,
        description,
        reference,
        source,
        status,
        metadata
    ) VALUES (
        v_wallet_id,
        p_user_id,
        'debit',
        p_amount,
        'MTN AFA Registration Fee',
        p_reference_code,
        'purchase',
        'completed',
        jsonb_build_object(
            'category', 'afa_order',
            'source',   'afa_registration'
        )
    )
    RETURNING id INTO v_transaction_id;

    -- Step 5: Insert AFA order record linked to transaction
    INSERT INTO public.afa_orders (
        user_id,
        full_name,
        phone,
        ghana_card,
        id_type,
        id_number,
        location,
        region,
        occupation,
        notes,
        status,
        payment_amount,
        reference_code,
        transaction_id
    ) VALUES (
        p_user_id,
        p_form_data->>'full_name',
        p_form_data->>'phone',
        p_form_data->>'id_number',   -- backward compat: ghana_card = id_number
        p_form_data->>'id_type',
        p_form_data->>'id_number',
        p_form_data->>'location',
        p_form_data->>'region',
        'Farmer',
        p_form_data->>'notes',
        'pending',
        p_amount,
        p_reference_code,
        v_transaction_id
    )
    RETURNING id INTO v_order_id;

    -- Step 6: Return consistent response shape
    RETURN json_build_object(
        'order_id',       v_order_id,
        'transaction_id', v_transaction_id,
        'new_balance',    v_new_balance
    );
END;
$$;

-- Source: supabase/adjust_shop_pricing_for_role_change.sql
-- ============================================================
-- RPC: adjust_shop_pricing_for_role_change
--
-- Called whenever an admin changes a user's role.
-- For each package that the shop owner has priced, this function:
--   1. Calculates the original profit margin:
--          profit = current_selling_price − old_role_cost_price
--   2. Derives the new selling price:
--          new_selling_price = new_role_cost_price + profit
-- The shop is never deactivated; only the selling price is updated
-- so that the owner's absolute profit per package is preserved.
--
-- Cost-price logic (mirroring the frontend getCostPrice() function)
--   agent    → data_packages.agent_price  (if > 0, otherwise falls back to .price)
--   dealer   → data_packages.dealer_price (if > 0, otherwise falls back to .price)
--   anything → data_packages.price
-- ============================================================

CREATE OR REPLACE FUNCTION adjust_shop_pricing_for_role_change(
    p_user_id  UUID,
    p_old_role TEXT,
    p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER   -- runs with elevated privileges so it can bypass RLS
AS $$
DECLARE
    v_shop_id        UUID;
    v_updated_count  INTEGER := 0;
    rec              RECORD;
    v_old_cost       DECIMAL(12,2);
    v_new_cost       DECIMAL(12,2);
    v_profit         DECIMAL(12,2);
    v_new_price      DECIMAL(12,2);
BEGIN
    -- 1. Find the user's shop
    SELECT id INTO v_shop_id
    FROM public.shop_profiles
    WHERE owner_id = p_user_id
    LIMIT 1;

    IF v_shop_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'updated', 0, 'message', 'No shop found for this user — nothing to adjust');
    END IF;

    -- 2. Loop over every pricing row for this shop
    FOR rec IN
        SELECT
            sp.id           AS pricing_id,
            sp.selling_price,
            dp.price        AS customer_price,
            dp.agent_price  AS agent_price,
            COALESCE(dp.dealer_price, 0) AS dealer_price
        FROM public.shop_pricing sp
        JOIN public.data_packages dp ON dp.id = sp.package_id
        WHERE sp.shop_id = v_shop_id
    LOOP
        -- Determine old cost price based on old role
        IF p_old_role = 'agent' AND rec.agent_price > 0 THEN
            v_old_cost := rec.agent_price;
        ELSIF p_old_role = 'dealer' AND rec.dealer_price > 0 THEN
            v_old_cost := rec.dealer_price;
        ELSE
            v_old_cost := rec.customer_price;
        END IF;

        -- Determine new cost price based on new role
        IF p_new_role = 'agent' AND rec.agent_price > 0 THEN
            v_new_cost := rec.agent_price;
        ELSIF p_new_role = 'dealer' AND rec.dealer_price > 0 THEN
            v_new_cost := rec.dealer_price;
        ELSE
            v_new_cost := rec.customer_price;
        END IF;

        -- Skip if both costs are identical (no adjustment needed)
        IF v_old_cost = v_new_cost THEN
            CONTINUE;
        END IF;

        -- Preserve the existing absolute profit margin
        v_profit    := rec.selling_price - v_old_cost;
        v_new_price := v_new_cost + v_profit;

        -- Ensure the new selling price is always at least 1 pesewa above cost
        IF v_new_price <= v_new_cost THEN
            v_new_price := v_new_cost + 0.01;
        END IF;

        -- Round to 2 decimal places
        v_new_price := ROUND(v_new_price, 2);

        -- Update the live pricing row
        UPDATE public.shop_pricing
        SET selling_price = v_new_price
        WHERE id = rec.pricing_id;

        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated', v_updated_count,
        'message', format('Adjusted %s pricing rows from %s to %s cost tier', v_updated_count, p_old_role, p_new_role)
    );
END;
$$;

-- Source: supabase/atomic_shop_credit.sql
-- Function to safely and atomically credit shop profit
-- Usage: supabase.rpc('credit_shop_profit', { p_shop_order_id: '...' })

CREATE OR REPLACE FUNCTION public.credit_shop_profit(p_shop_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- ALIAS FOR avoids parameter resolution issues with SECURITY DEFINER + empty search_path
  _shop_order_id   ALIAS FOR $1;
  v_profit         DECIMAL;
  v_owner_id       UUID;
  v_wallet_id      UUID;
  v_guest_phone    TEXT;
  v_network        TEXT;
  v_package_size   TEXT;
  v_existing_tx_id UUID;
  v_rows_inserted  INT;
BEGIN
  -- 0. Advisory lock: serialise concurrent calls for the same order
  --    Prevents two simultaneous webhooks from double-crediting the same order
  PERFORM pg_advisory_xact_lock(hashtext(_shop_order_id::text));

  -- 1. Fetch Order & Owner Details
  SELECT
    so.profit,
    sp.owner_id,
    so.network,
    so.package_size,
    so.guest_phone
  INTO
    v_profit,
    v_owner_id,
    v_network,
    v_package_size,
    v_guest_phone
  FROM public.shop_orders so
  JOIN public.shop_profiles sp ON so.shop_id = sp.id
  WHERE so.id = _shop_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF v_profit <= 0 OR v_profit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No profit to credit');
  END IF;

  -- 2. Idempotency Check (safe after advisory lock — no race between check and insert)
  SELECT id INTO v_existing_tx_id
  FROM public.shop_wallet_transactions
  WHERE shop_order_id = _shop_order_id AND type = 'profit';

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already credited');
  END IF;

  -- 3. Get or Create Wallet (Atomic Upsert)
  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_owner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  SELECT id INTO v_wallet_id
  FROM public.shop_wallets
  WHERE owner_id = v_owner_id;

  -- 4. Atomic Balance Update
  UPDATE public.shop_wallets
  SET
    balance      = balance + v_profit,
    total_earned = total_earned + v_profit,
    updated_at   = NOW()
  WHERE id = v_wallet_id;

  -- 5. Log Transaction
  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, shop_order_id, type, amount, description, status)
  VALUES
    (v_wallet_id, _shop_order_id, 'profit', v_profit,
     'Sale: ' || COALESCE(v_network, '') || ' ' || COALESCE(v_package_size, '') || ' to ' || COALESCE(v_guest_phone, 'Guest'),
     'completed');

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  IF v_rows_inserted = 0 THEN
    -- Shouldn't happen after advisory lock, but guard anyway
    RETURN jsonb_build_object('success', true, 'message', 'Already credited (concurrent)');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Credited ' || v_profit);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Source: supabase/chat_schema.sql
-- Create function to update last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Source: supabase/dashboard_stats_optimizations.sql
-- Optimization: RPC functions to calculate dashboard stats in the database
-- This prevents fetching thousands of rows and processing them in JavaScript (Vercel server-side CPU)

-- 1. Admin Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalUsers', (SELECT count(*) FROM public.users),
        'totalOrders', (SELECT count(*) FROM public.orders),
        'completedOrders', (SELECT count(*) FROM public.orders WHERE status = 'completed'),
        'pendingOrders', (SELECT count(*) FROM public.orders WHERE status IN ('pending', 'processing')),
        'totalRevenue', COALESCE((SELECT sum(price) FROM public.orders WHERE status = 'completed'), 0),
        'totalWalletBalance', COALESCE((SELECT sum(balance) FROM public.wallets), 0),
        'successRate', CASE
            WHEN (SELECT count(*) FROM public.orders) > 0
            THEN round(((SELECT count(*) FROM public.orders WHERE status = 'completed')::float / (SELECT count(*) FROM public.orders)::float) * 100)
            ELSE 0
        END,
        'todayOrders', (SELECT count(*) FROM public.orders WHERE created_at >= CURRENT_DATE)
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: supabase/dashboard_stats_optimizations.sql
-- 2. User Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND shop_order_id IS NULL),
        'completedOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'completed' AND shop_order_id IS NULL),
        'processingOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'processing' AND shop_order_id IS NULL),
        'failedOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'failed' AND shop_order_id IS NULL),
        'pendingOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'pending' AND shop_order_id IS NULL),
        'walletBalance', COALESCE((SELECT balance FROM public.wallets WHERE user_id = p_user_id), 0)
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: supabase/delete_shop_rpc.sql
-- Function to safely delete an entire shop and its associated data
-- Usage: supabase.rpc('delete_shop_data')

CREATE OR REPLACE FUNCTION public.delete_shop_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_shop_id UUID;
  v_wallet_id UUID;
BEGIN
  v_owner_id := auth.uid();

  IF v_owner_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- 1. Identify shop and wallet
  SELECT id INTO v_shop_id FROM public.shop_profiles WHERE owner_id = v_owner_id;
  SELECT id INTO v_wallet_id FROM public.shop_wallets WHERE owner_id = v_owner_id;

  IF v_shop_id IS NULL AND v_wallet_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'No shop found to delete');
  END IF;

  -- 2. Delete Wallet (Cascades to Transactions)
  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM public.shop_wallets WHERE id = v_wallet_id;
  END IF;

  -- 3. Delete Profile (Cascades to Orders, Pricing)
  IF v_shop_id IS NOT NULL THEN
    DELETE FROM public.shop_profiles WHERE id = v_shop_id;
  END IF;

  -- 4. Clean up any orphaned Shop Orders (just in case)
  -- (Though partial shop deletion without profile shouldn't happen, good to be safe)
  -- DELETE FROM public.shop_orders WHERE shop_id = v_shop_id; -- Handled by CASCADE

  RETURN jsonb_build_object('success', true, 'message', 'Shop deleted successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Source: supabase/dual_fee_config_migration.sql
-- ============================================================
-- 2. Security Trigger: Protect admin-only columns on shop_profiles
-- Prevents authenticated shop owners from using the Supabase client
-- directly to manipulate their own fee overrides.
-- Service role (server-side APIs) bypasses this trigger safely.
-- ============================================================

CREATE OR REPLACE FUNCTION protect_shop_admin_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce restriction for standard authenticated users (shop owners).
  -- Server-side calls using the service role bypass RLS entirely and
  -- are NOT subject to this trigger guard (auth.role() will be null or 'service_role').
  IF auth.role() = 'authenticated' THEN
    -- Force sensitive admin-only columns to remain unchanged
    NEW.paystack_fee_percent      := OLD.paystack_fee_percent;
    NEW.withdrawal_fee_percent    := OLD.withdrawal_fee_percent;
    NEW.withdrawal_fee_flat       := OLD.withdrawal_fee_flat;
    NEW.min_withdrawal_amount     := OLD.min_withdrawal_amount;
    NEW.approval_status           := OLD.approval_status;
    NEW.fulfillment_mode          := OLD.fulfillment_mode;
    NEW.is_active                 := OLD.is_active;
    NEW.approved_by               := OLD.approved_by;
    NEW.approved_at               := OLD.approved_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: supabase/fix_admin_permissions_robust.sql
-- ============================================================
-- Robust Admin Permissions Fix (Security Definer Approach)
-- Run this in your Supabase SQL Editor to fix invisible shops
-- ============================================================

-- 1. Create a secure function to check admin status (Bypasses RLS)
-- This prevents infinite recursion loops when policies query the users table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER -- Runs with privileges of the creator (postgres), bypassing RLS
SET search_path = public -- Secure search path
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'sub-admin')
  );
$$;

-- Source: supabase/fix_resubmission_rpc.sql
-- ============================================================
-- Fix: Secure RPC for Shop Owner Withdrawal Resubmission
-- RUN THIS AS A **NEW QUERY** in Supabase SQL Editor
-- ============================================================
-- Why: Shop owners do not have RLS UPDATE permission on
-- shop_wallet_transactions (unsafe). This function runs with
-- elevated DB privileges (SECURITY DEFINER) but strictly
-- limits what can be changed — payment details only.
-- Amount, fee, net_amount, and balance_snapshot are LOCKED.
-- ============================================================

-- First, create the new secure function with 4 parameters
CREATE OR REPLACE FUNCTION public.resubmit_withdrawal(
    p_transaction_id UUID,
    p_account_name   TEXT,
    p_momo_number    TEXT,
    p_network        TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_note TEXT;
    v_new_note     TEXT;
BEGIN
    -- Get the current admin note
    SELECT admin_note INTO v_current_note
    FROM public.shop_wallet_transactions
    WHERE id = p_transaction_id
      AND status = 'rejected'
      AND shop_wallet_id IN (
          SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid()
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resubmission failed: transaction not found, not rejected, or does not belong to you.';
    END IF;

    -- Build the hardcoded audit trail note server-side
    v_new_note := '[RESUBMITTED] Previously rejected: "' || COALESCE(v_current_note, 'No reason given') || '". New payment details provided.';

    -- Perform the extremely restricted update
    UPDATE public.shop_wallet_transactions
    SET
        status       = 'pending',
        account_name = p_account_name,
        momo_number  = p_momo_number,
        network      = p_network,
        admin_note   = v_new_note,
        updated_at   = NOW()
    WHERE id = p_transaction_id;
END;
$$;

-- Source: supabase/triggers.sql
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

-- Source: supabase/fix_wallet_rpc.sql
CREATE OR REPLACE FUNCTION public.get_user_transactions_with_balance(
    p_user_id UUID,
    p_limit INTEGER,
    p_offset INTEGER,
    p_source_filter TEXT DEFAULT 'all',
    p_type_filter TEXT DEFAULT 'all',
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    amount DECIMAL,
    type TEXT,
    description TEXT,
    reference TEXT,
    source TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    balance_before DECIMAL,
    balance_after DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL;
BEGIN
    -- 1. Get current wallet balance
    SELECT balance INTO v_current_balance
    FROM public.wallets
    WHERE user_id = p_user_id;

    -- Default to 0 if no wallet found
    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;

    RETURN QUERY
    SELECT
        t.id,
        t.amount,
        t.type,
        t.description,
        t.reference,
        t.source,
        t.status,
        t.created_at,
        -- Calculate Balance Before
        (
            v_current_balance -
            -- Net change of ALL transactions that happened AFTER this one
            COALESCE((
                SELECT SUM(
                    CASE WHEN t2.type = 'credit' THEN t2.amount ELSE -t2.amount END
                )
                FROM public.wallet_transactions t2
                WHERE t2.user_id = p_user_id
                AND (t2.created_at > t.created_at OR (t2.created_at = t.created_at AND t2.id > t.id))
            ), 0)
            -- Subtract THIS transaction's effect to get "Before" state
            - (CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END)
        )::DECIMAL as balance_before,

        -- Calculate Balance After
        (
            v_current_balance -
            -- Net change of ALL transactions that happened AFTER this one
            COALESCE((
                SELECT SUM(
                    CASE WHEN t2.type = 'credit' THEN t2.amount ELSE -t2.amount END
                )
                FROM public.wallet_transactions t2
                WHERE t2.user_id = p_user_id
                AND (t2.created_at > t.created_at OR (t2.created_at = t.created_at AND t2.id > t.id))
            ), 0)
        )::DECIMAL as balance_after
    FROM public.wallet_transactions t
    WHERE t.user_id = p_user_id
    AND (p_source_filter = 'all' OR t.source = p_source_filter)
    AND (p_type_filter = 'all' OR t.type = p_type_filter)
    AND (p_start_date IS NULL OR t.created_at >= p_start_date)
    AND (p_end_date IS NULL OR t.created_at <= p_end_date)
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Source: supabase/get_shop_orders_rpc.sql
-- Secure RPC to fetch shop orders for guests (bypasses RLS)
-- This function allows anyone to fetch orders if they know the phone number.
-- It returns orders + basic shop details.

create or replace function get_shop_orders_by_phone(
  phone_number text,
  limit_count int default 20
)
returns table (
  id uuid,
  network text,
  package_size text,
  selling_price numeric,
  status text,
  created_at timestamptz,
  guest_phone text,
  shop_name text,
  shop_slug text
)
language plpgsql
security definer -- ✨ Runs with admin privileges to bypass RLS
as $$
begin
  return query
  select
    so.id,
    so.network,
    so.package_size,
    so.selling_price,
    so.status,
    so.created_at,
    so.guest_phone,
    sp.shop_name,
    sp.shop_slug
  from shop_orders so
  join shop_profiles sp on so.shop_id = sp.id
  where so.guest_phone = phone_number
  order by so.created_at desc
  limit limit_count;
end;
$$;

-- Source: supabase/shop_withdrawal_improvements.sql
-- 6. Trigger: enforce max 5 saved details per owner
CREATE OR REPLACE FUNCTION public.enforce_max_payment_details()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.shop_payment_details WHERE shop_owner_id = NEW.shop_owner_id) >= 5 THEN
        RAISE EXCEPTION 'You can only save a maximum of 5 payment details.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Source: supabase/shop_withdrawal_improvements.sql
-- 7. Trigger: ensure only one default per owner
--    When a row is set as default, clear others for that owner.
CREATE OR REPLACE FUNCTION public.enforce_single_default_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE public.shop_payment_details
        SET is_default = FALSE
        WHERE shop_owner_id = NEW.shop_owner_id
          AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Source: supabase/sync_shop_orders_trigger.sql
-- =========================================================================================
-- ENFORCE SINGLE SOURCE OF TRUTH FOR ORDER STATUS
-- =========================================================================================
-- This creates a PostgreSQL trigger that instantly syncs status changes
-- from the main `orders` table down to the `shop_orders` table.
-- This ensures the shop user history ALWAYS matches the admin fulfillment page.
-- =========================================================================================

-- 1. Create the sync function
CREATE OR REPLACE FUNCTION sync_shop_order_status_from_orders()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if there is a linked shop order and the status has changed (or it's a new row)
    IF NEW.shop_order_id IS NOT NULL THEN
        IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)) THEN

            -- Only update the shop_order if its status doesn't already match the new status
            -- (This prevents redundant updates if the API already updated it)
            UPDATE shop_orders
            SET
                status = NEW.status,
                updated_at = NOW()
            WHERE id = NEW.shop_order_id
              AND status IS DISTINCT FROM NEW.status;

        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- ==================================================
-- 8. VIEWS
-- ==================================================

-- Source: supabase/migrations/20260422_security_hardening_p0.sql
-- Step 2: Recreate with security_invoker (default, RLS-respecting behaviour)
CREATE OR REPLACE VIEW public.afa_registrations
WITH (security_invoker = true)
AS
SELECT
  ao.id,
  ao.user_id,
  ao.full_name,
  ao.phone,
  ao.ghana_card,
  ao.id_type,
  ao.id_number,
  ao.location,
  ao.region,
  ao.occupation,
  ao.date_of_birth,
  ao.notes,
  ao.status,
  ao.payment_amount,
  ao.reference_code,
  ao.transaction_id,
  ao.created_at,
  u.email        AS user_email,
  u.first_name   AS user_first_name,
  u.last_name    AS user_last_name,
  u.phone_number AS user_phone
FROM public.afa_orders ao
LEFT JOIN public.users u ON u.id = ao.user_id;

-- Source: supabase/migrations/20260508_public_safe_settings_and_shop_lookup.sql
-- Security fixes 2026-05-08:
-- 1. Expose only approved public admin settings through a narrow view.
-- 2. Replace phone-only guest shop order lookup with phone + Paystack reference lookup.
--
-- Important: this migration intentionally does NOT drop the open admin_settings
-- read policy. Per deployment gate, that destructive restriction must happen only
-- after the application has been deployed and verified against public_admin_settings.

create or replace view public.public_admin_settings as
select key, value
from public.admin_settings
where key in (
  'guest_storefront_url',
  'whatsapp_group_link',
  'whatsapp_channel_link',
  'whatsapp_admin_number',
  'whatsapp_community_link',
  'support_email',
  'footer_copyright_text',
  'footer_branding_text',
  'announcement_enabled',
  'announcement_title',
  'announcement_message',
  'agent_upgrade_price_3d',
  'agent_upgrade_price_14d',
  'agent_upgrade_price_30d',
  'agent_upgrade_price_permanent',
  'agent_upgrade_price_3d_old',
  'agent_upgrade_price_14d_old',
  'agent_upgrade_price_30d_old',
  'agent_upgrade_price_permanent_old',
  'show_price_strikethrough',
  'page_access_dashboard',
  'page_access_data_packages',
  'page_access_orders',
  'page_access_wallet',
  'page_access_complaints',
  'page_access_notifications',
  'page_access_profile',
  'page_access_shop',
  'page_access_storefront',
  'page_access_airtime',
  'storefront_airtime_enabled',
  'airtime_fee_mtn_customer',
  'airtime_fee_mtn_agent',
  'airtime_fee_telecel_customer',
  'airtime_fee_telecel_agent',
  'airtime_fee_at_customer',
  'airtime_fee_at_agent',
  'airtime_min_amount',
  'airtime_max_amount',
  'airtime_enabled_mtn',
  'airtime_enabled_telecel',
  'airtime_enabled_at'
);



-- ==================================================
-- 9. TRIGGERS
-- ==================================================

-- Source: supabase/schema.sql
DROP TRIGGER IF EXISTS on_user_created_wallet ON public.users;
CREATE TRIGGER on_user_created_wallet
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_wallet();

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
DROP TRIGGER IF EXISTS trg_protect_shop_pricing ON public.shop_pricing;
CREATE TRIGGER trg_protect_shop_pricing
BEFORE UPDATE ON public.shop_pricing
FOR EACH ROW
EXECUTE FUNCTION protect_shop_pricing_updates();

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
DROP TRIGGER IF EXISTS trg_auto_update_shop_pricing ON public.data_packages;
CREATE TRIGGER trg_auto_update_shop_pricing
AFTER UPDATE OF price, agent_price ON public.data_packages
FOR EACH ROW
EXECUTE FUNCTION auto_update_shop_pricing_on_platform_cost();

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DROP TRIGGER IF EXISTS trg_log_main_profit ON public.orders;
CREATE TRIGGER trg_log_main_profit AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_main_profit();

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DROP TRIGGER IF EXISTS trg_log_shop_profit ON public.shop_orders;
CREATE TRIGGER trg_log_shop_profit AFTER UPDATE ON public.shop_orders
FOR EACH ROW EXECUTE FUNCTION public.log_shop_profit();

-- Source: supabase/chat_schema.sql
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON public.chat_messages;
CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

-- Source: supabase/dual_fee_config_migration.sql
DROP TRIGGER IF EXISTS enforce_shop_admin_columns ON public.shop_profiles;
CREATE TRIGGER enforce_shop_admin_columns
BEFORE UPDATE ON public.shop_profiles
FOR EACH ROW EXECUTE FUNCTION protect_shop_admin_columns();

-- Source: supabase/shop_withdrawal_improvements.sql
DROP TRIGGER IF EXISTS trg_max_payment_details ON public.shop_payment_details;
CREATE TRIGGER trg_max_payment_details
    BEFORE INSERT ON public.shop_payment_details
    FOR EACH ROW EXECUTE FUNCTION public.enforce_max_payment_details();

-- Source: supabase/shop_withdrawal_improvements.sql
DROP TRIGGER IF EXISTS trg_single_default_payment ON public.shop_payment_details;
CREATE TRIGGER trg_single_default_payment
    AFTER INSERT OR UPDATE ON public.shop_payment_details
    FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_payment();

-- Source: supabase/sync_shop_orders_trigger.sql
DROP TRIGGER IF EXISTS on_order_status_change ON orders;
-- 3. Create the trigger on the 'orders' table
CREATE TRIGGER on_order_status_change
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION sync_shop_order_status_from_orders();

-- Source: supabase/triggers.sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();



-- ==================================================
-- 10. ENABLE RLS
-- ==================================================

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    -- Row Level Security Policies

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.wallet_payments ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.data_packages ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.afa_orders ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    -- Enable RLS
alter table public.system_announcements enable row level security;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20250001000000_download_batches_rls.sql
DO $idempotent_block$
BEGIN
    -- Enable RLS
ALTER TABLE public.download_batches
  ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260326_fix_unrestricted_tables.sql
DO $idempotent_block$
BEGIN
    -- Enable RLS on admin_profit_logs
ALTER TABLE public.admin_profit_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260326_fix_unrestricted_tables.sql
DO $idempotent_block$
BEGIN
    -- Enable RLS on shop_pricing_logs
ALTER TABLE public.shop_pricing_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260406_fix_rls_vulnerabilities.sql
DO $idempotent_block$
BEGIN
    -- 1d. Ensure RLS is enabled (idempotent)
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260406_fix_rls_vulnerabilities.sql
DO $idempotent_block$
BEGIN
    -- 2c. Ensure RLS is enabled
ALTER TABLE public.phone_blacklist ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260406_fix_rls_vulnerabilities.sql
DO $idempotent_block$
BEGIN
    -- 3d. Ensure RLS is enabled
ALTER TABLE public.shop_global_settings ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
DO $idempotent_block$
BEGIN
    -- ============================================================================
-- 4. Row-Level Security (RLS) Policies
-- ============================================================================
ALTER TABLE public.results_checker_types ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.results_checker_inventory ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.results_checker_orders ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_announcements_schema.sql
DO $idempotent_block$
BEGIN
    -- 3. Enable RLS
ALTER TABLE public.shop_announcements ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    -- 4. Enable RLS
ALTER TABLE public.shop_pricing_pending ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/airtime_migration.sql
DO $idempotent_block$
BEGIN
    -- RLS
ALTER TABLE public.airtime_orders ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    -- Enable Row Level Security
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    -- ============================================================================
-- SUPABASE SECURITY FIX
-- Fix for 4 RLS errors detected by Security Advisor
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Row Level Security on all 4 tables
-- ============================================================================

ALTER TABLE public.mtn_fulfillment_tracking ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.fulfillment_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_shop_guest_access_v2.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_withdrawal_rls_and_name.sql
DO $idempotent_block$
BEGIN
    -- 4. Enable RLS on shop_wallet_transactions if not already active (it should be)
ALTER TABLE public.shop_wallet_transactions ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/push_subscriptions.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/repair_shop_system.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_pricing ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/repair_shop_system.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_wallets ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_storage_policy.sql
DO $idempotent_block$
BEGIN
    -- 2. Enable RLS on objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_withdrawal_improvements.sql
DO $idempotent_block$
BEGIN
    -- 3. Enable RLS on shop_payment_details
ALTER TABLE public.shop_payment_details ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;



-- ==================================================
-- 11. POLICIES
-- ==================================================

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own payments' AND tablename = 'wallet_payments'
    ) THEN
        CREATE POLICY "Users can view own payments"
  ON public.wallet_payments FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'users'
    ) THEN
        CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'users'
    ) THEN
        CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own profile' AND tablename = 'users'
    ) THEN
        CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own wallet' AND tablename = 'wallets'
    ) THEN
        CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own transactions' AND tablename = 'wallet_transactions'
    ) THEN
        CREATE POLICY "Users can view own transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own orders' AND tablename = 'orders'
    ) THEN
        CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can create orders' AND tablename = 'orders'
    ) THEN
        CREATE POLICY "Users can create orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own notifications' AND tablename = 'notifications'
    ) THEN
        CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own notifications' AND tablename = 'notifications'
    ) THEN
        CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own notifications' AND tablename = 'notifications'
    ) THEN
        CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own complaints' AND tablename = 'complaints'
    ) THEN
        CREATE POLICY "Users can view own complaints"
  ON public.complaints FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can create complaints' AND tablename = 'complaints'
    ) THEN
        CREATE POLICY "Users can create complaints"
  ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view packages' AND tablename = 'data_packages'
    ) THEN
        -- Data packages policies (public read)
CREATE POLICY "Anyone can view packages" ON public.data_packages
  FOR SELECT USING (true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own customer purchases' AND tablename = 'customer_purchases'
    ) THEN
        CREATE POLICY "Users can view own customer purchases"
  ON public.customer_purchases FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own AFA orders' AND tablename = 'afa_orders'
    ) THEN
        CREATE POLICY "Users can view own AFA orders"
  ON public.afa_orders FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can create AFA orders' AND tablename = 'afa_orders'
    ) THEN
        CREATE POLICY "Users can create AFA orders"
  ON public.afa_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public read access' AND tablename = 'system_announcements'
    ) THEN
        -- Policies
create policy "Public read access"
  on public.system_announcements for select
  using (true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access' AND tablename = 'system_announcements'
    ) THEN
        CREATE POLICY "Admin full access"
  ON public.system_announcements FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage download_batches' AND tablename = 'download_batches'
    ) THEN
        CREATE POLICY "Admins can manage download_batches"
  ON public.download_batches FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin', 'sub_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin', 'sub_admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260326_fix_unrestricted_tables.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view profit logs' AND tablename = 'admin_profit_logs'
    ) THEN
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
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260422_security_hardening_p1_p3.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view shop pricing logs' AND tablename = 'shop_pricing_logs'
    ) THEN
        CREATE POLICY "Admins can view shop pricing logs"
ON public.shop_pricing_logs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'sub-admin')
));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260328_create_shop_banners_bucket.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Shop Banners Public Read' AND tablename = 'objects'
    ) THEN
        -- Policy to allow anyone to view shop-banners files
CREATE POLICY "Shop Banners Public Read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shop-banners');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260328_create_shop_banners_bucket.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Shop Banners Auth Insert' AND tablename = 'objects'
    ) THEN
        -- Policy to allow authenticated users to insert files to their own folder within shop-banners
CREATE POLICY "Shop Banners Auth Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'shop-banners'
    AND (auth.uid()::text = (storage.foldername(name))[1])
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260328_create_shop_banners_bucket.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Shop Banners Auth Update' AND tablename = 'objects'
    ) THEN
        -- Policy to allow authenticated users to update files in their own folder
CREATE POLICY "Shop Banners Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'shop-banners'
    AND (auth.uid()::text = (storage.foldername(name))[1])
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260328_create_shop_banners_bucket.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Shop Banners Auth Delete' AND tablename = 'objects'
    ) THEN
        -- Policy to allow authenticated users to delete files in their own folder
CREATE POLICY "Shop Banners Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'shop-banners'
    AND (auth.uid()::text = (storage.foldername(name))[1])
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_orders_shop_owner_read' AND tablename = 'shop_orders'
    ) THEN
        CREATE POLICY "shop_orders_shop_owner_read"
  ON public.shop_orders FOR SELECT TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM public.shop_profiles
      WHERE owner_id = (SELECT auth.uid())
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_orders_admin_read' AND tablename = 'shop_orders'
    ) THEN
        CREATE POLICY "shop_orders_admin_read"
  ON public.shop_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'phone_blacklist_admin_only' AND tablename = 'phone_blacklist'
    ) THEN
        CREATE POLICY "phone_blacklist_admin_only"
  ON public.phone_blacklist FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260406_fix_rls_vulnerabilities.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_global_settings_public_read' AND tablename = 'shop_global_settings'
    ) THEN
        -- 3b. Allow anon and authenticated to READ (required for guest checkout flow)
CREATE POLICY "shop_global_settings_public_read"
ON public.shop_global_settings
FOR SELECT
TO anon, authenticated
USING (true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_global_settings_admin_write' AND tablename = 'shop_global_settings'
    ) THEN
        CREATE POLICY "shop_global_settings_admin_write"
  ON public.shop_global_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260422_update_admin_settings_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read admin settings' AND tablename = 'admin_settings'
    ) THEN
        -- Create a new policy that allows anyone to read from admin_settings
CREATE POLICY "Anyone can read admin settings"
ON public.admin_settings
FOR SELECT
TO anon, authenticated
USING (true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_types_select_all' AND tablename = 'results_checker_types'
    ) THEN
        CREATE POLICY "rc_types_select_all" ON public.results_checker_types FOR SELECT USING (true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_types_write_admin' AND tablename = 'results_checker_types'
    ) THEN
        CREATE POLICY "rc_types_write_admin" ON public.results_checker_types FOR ALL TO service_role USING (true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_inventory_admin_only' AND tablename = 'results_checker_inventory'
    ) THEN
        CREATE POLICY "rc_inventory_admin_only" ON public.results_checker_inventory FOR ALL USING (auth.role() = 'service_role');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_orders_user_select' AND tablename = 'results_checker_orders'
    ) THEN
        CREATE POLICY "rc_orders_user_select"
  ON public.results_checker_orders FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT auth.role()) = 'service_role'
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260520_results_checker_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_orders_admin_all' AND tablename = 'results_checker_orders'
    ) THEN
        CREATE POLICY "rc_orders_admin_all" ON public.results_checker_orders FOR ALL USING (auth.role() = 'service_role');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'api_keys: user select own' AND tablename = 'api_keys'
    ) THEN
        DO $$ BEGIN
    CREATE POLICY "api_keys: user select own" ON public.api_keys FOR SELECT USING (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'api_keys: user insert own' AND tablename = 'api_keys'
    ) THEN
        DO $$ BEGIN
    CREATE POLICY "api_keys: user insert own" ON public.api_keys FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'api_keys: user delete own' AND tablename = 'api_keys'
    ) THEN
        DO $$ BEGIN
    CREATE POLICY "api_keys: user delete own" ON public.api_keys FOR DELETE USING (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'api_keys: admin full access' AND tablename = 'api_keys'
    ) THEN
        DO $$ BEGIN
    CREATE POLICY "api_keys: admin full access" ON public.api_keys FOR ALL
        USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'api_logs: admin read all' AND tablename = 'api_logs'
    ) THEN
        DO $$ BEGIN
    CREATE POLICY "api_logs: admin read all" ON public.api_logs FOR SELECT
        USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'api_logs: user read own' AND tablename = 'api_logs'
    ) THEN
        DO $$ BEGIN
    CREATE POLICY "api_logs: user read own" ON public.api_logs FOR SELECT USING (user_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_developer_api.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'api_logs: service insert' AND tablename = 'api_logs'
    ) THEN
        DO $$ BEGIN
    CREATE POLICY "api_logs: service insert" ON public.api_logs FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/airtime_migration.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own airtime orders' AND tablename = 'airtime_orders'
    ) THEN
        -- Users see only their own orders
CREATE POLICY "Users can view own airtime orders" ON public.airtime_orders
  FOR SELECT USING (auth.uid() = user_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/airtime_migration.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can create airtime orders' AND tablename = 'airtime_orders'
    ) THEN
        CREATE POLICY "Users can create airtime orders" ON public.airtime_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/airtime_migration.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all airtime orders' AND tablename = 'airtime_orders'
    ) THEN
        -- Admins and sub-admins see ALL orders (service-role bypasses RLS anyway, but this covers dashboard queries)
CREATE POLICY "Admins can view all airtime orders" ON public.airtime_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/airtime_migration.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update airtime orders' AND tablename = 'airtime_orders'
    ) THEN
        CREATE POLICY "Admins can update airtime orders" ON public.airtime_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access to mtn fulfillment tracking' AND tablename = 'mtn_fulfillment_tracking'
    ) THEN
        -- Admins can do everything
CREATE POLICY "Admin full access to mtn fulfillment tracking"
ON public.mtn_fulfillment_tracking
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
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access to fulfillment logs' AND tablename = 'fulfillment_logs'
    ) THEN
        -- Admins can do everything
CREATE POLICY "Admin full access to fulfillment logs"
ON public.fulfillment_logs
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
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin modify access to admin settings' AND tablename = 'admin_settings'
    ) THEN
        -- Only full admins can modify settings (not sub-admins)
CREATE POLICY "Admin modify access to admin settings"
ON public.admin_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin only access' AND tablename = 'pending_settlements'
    ) THEN
        CREATE POLICY "Admin only access"
  ON public.pending_settlements FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_withdrawal_rls_and_name.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update their own shop wallet' AND tablename = 'shop_wallets'
    ) THEN
        CREATE POLICY "Owners can update their own shop wallet"
ON public.shop_wallets
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_wallet_transactions_owner_read' AND tablename = 'shop_wallet_transactions'
    ) THEN
        -- Shop wallet transactions: owners can read their own
CREATE POLICY "shop_wallet_transactions_owner_read" ON public.shop_wallet_transactions
  FOR SELECT USING (
    shop_wallet_id IN (SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid())
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/harden_shop_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_shop_transactions' AND tablename = 'shop_wallet_transactions'
    ) THEN
        CREATE POLICY "admin_all_shop_transactions" ON public.shop_wallet_transactions
FOR ALL
TO authenticated
USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'subadmin')
)
WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'subadmin')
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_withdrawal_rls_and_name.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert their own shop transactions' AND tablename = 'shop_wallet_transactions'
    ) THEN
        CREATE POLICY "Owners can insert their own shop transactions"
ON public.shop_wallet_transactions
FOR INSERT
WITH CHECK (
    shop_wallet_id IN (
        SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid()
    )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_announcements_owner_all' AND tablename = 'shop_announcements'
    ) THEN
        -- Shop announcements: owners manage all; public read only active
CREATE POLICY "shop_announcements_owner_all" ON public.shop_announcements
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_global_settings_read' AND tablename = 'shop_global_settings'
    ) THEN
        -- Global settings: authenticated users can read
CREATE POLICY "shop_global_settings_read" ON public.shop_global_settings
  FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_types_admin_insert' AND tablename = 'results_checker_types'
    ) THEN
        CREATE POLICY "rc_types_admin_insert"
  ON public.results_checker_types FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_types_admin_update' AND tablename = 'results_checker_types'
    ) THEN
        CREATE POLICY "rc_types_admin_update"
  ON public.results_checker_types FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_types_admin_delete' AND tablename = 'results_checker_types'
    ) THEN
        CREATE POLICY "rc_types_admin_delete"
  ON public.results_checker_types FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_inventory_admin_select' AND tablename = 'results_checker_inventory'
    ) THEN
        CREATE POLICY "rc_inventory_admin_select"
  ON public.results_checker_inventory FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_inventory_admin_insert' AND tablename = 'results_checker_inventory'
    ) THEN
        CREATE POLICY "rc_inventory_admin_insert"
  ON public.results_checker_inventory FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_inventory_admin_update' AND tablename = 'results_checker_inventory'
    ) THEN
        CREATE POLICY "rc_inventory_admin_update"
  ON public.results_checker_inventory FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_inventory_admin_delete' AND tablename = 'results_checker_inventory'
    ) THEN
        CREATE POLICY "rc_inventory_admin_delete"
  ON public.results_checker_inventory FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_orders_admin_insert' AND tablename = 'results_checker_orders'
    ) THEN
        CREATE POLICY "rc_orders_admin_insert"
  ON public.results_checker_orders FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_fix_rls_initplan_performance.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'rc_orders_admin_update' AND tablename = 'results_checker_orders'
    ) THEN
        CREATE POLICY "rc_orders_admin_update"
  ON public.results_checker_orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'sub-admin')
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_announcements_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public can read shop announcements' AND tablename = 'shop_announcements'
    ) THEN
        CREATE POLICY "Public can read shop announcements"
    ON public.shop_announcements FOR SELECT
    USING (is_active = true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_announcements_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Shop owners can manage their own announcements' AND tablename = 'shop_announcements'
    ) THEN
        CREATE POLICY "Shop owners can manage their own announcements"
    ON public.shop_announcements FOR ALL
    TO authenticated
    USING (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
    );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_pricing_pending_owner' AND tablename = 'shop_pricing_pending'
    ) THEN
        -- 5. RLS policies (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shop_pricing_pending' AND policyname = 'shop_pricing_pending_owner'
  ) THEN
    CREATE POLICY "shop_pricing_pending_owner" ON public.shop_pricing_pending
      FOR ALL USING (
        shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
      );
  END IF;
END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_pricing_approval.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_pricing_pending_admin' AND tablename = 'shop_pricing_pending'
    ) THEN
        DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shop_pricing_pending' AND policyname = 'shop_pricing_pending_admin'
  ) THEN
    CREATE POLICY "shop_pricing_pending_admin" ON public.shop_pricing_pending
      FOR ALL USING (public.is_admin());
  END IF;
END $$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_profiles_public_read' AND tablename = 'shop_profiles'
    ) THEN
        CREATE POLICY "shop_profiles_public_read" ON public.shop_profiles
  FOR SELECT USING (approval_status = 'approved' AND is_active = true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_pricing_public_read' AND tablename = 'shop_pricing'
    ) THEN
        CREATE POLICY "shop_pricing_public_read" ON public.shop_pricing
  FOR SELECT USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE approval_status = 'approved' AND is_active = true)
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/afa_admin_policies.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access to afa_orders' AND tablename = 'afa_orders'
    ) THEN
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
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Agents can view own conversations' AND tablename = 'chat_conversations'
    ) THEN
        -- RLS Policies for chat_conversations
-- Agents can see their own conversations
CREATE POLICY "Agents can view own conversations"
ON public.chat_conversations FOR SELECT
USING (
    agent_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
    )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all conversations' AND tablename = 'chat_conversations'
    ) THEN
        -- Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
ON public.chat_conversations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
    )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Agents can create conversations' AND tablename = 'chat_conversations'
    ) THEN
        -- Agents can create conversations
CREATE POLICY "Agents can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (
    agent_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'agent'
    )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view conversation messages' AND tablename = 'chat_messages'
    ) THEN
        -- RLS Policies for chat_messages
-- Users can see messages in their conversations
CREATE POLICY "Users can view conversation messages"
ON public.chat_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id
        AND (
            c.agent_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
            )
        )
    )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert messages' AND tablename = 'chat_messages'
    ) THEN
        -- Users can insert messages in their conversations
CREATE POLICY "Users can insert messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id
        AND (
            c.agent_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
            )
        )
    )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own message read status' AND tablename = 'chat_messages'
    ) THEN
        -- Users can update read status of messages
CREATE POLICY "Users can update own message read status"
ON public.chat_messages FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id
        AND (
            c.agent_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id
        AND (
            c.agent_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
            )
        )
    )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_admin_permissions_robust.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins view all shops' AND tablename = 'shop_profiles'
    ) THEN
        -- Create new robust policies using the function
CREATE POLICY "Admins view all shops"
ON public.shop_profiles
FOR SELECT
USING ( public.is_admin() );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_admin_permissions_robust.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins update all shops' AND tablename = 'shop_profiles'
    ) THEN
        CREATE POLICY "Admins update all shops"
ON public.shop_profiles
FOR UPDATE
USING ( public.is_admin() );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_admin_permissions_robust.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins view all users' AND tablename = 'users'
    ) THEN
        DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Admins view all users'
  ) THEN
    CREATE POLICY "Admins view all users"
    ON public.users
    FOR SELECT
    USING ( public.is_admin() );
  END IF;
END
$$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_admin_wallet_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins view all shop wallets' AND tablename = 'shop_wallets'
    ) THEN
        -- ============================================================
-- Grant Admin Access to Shop Wallets and Transactions
-- ============================================================

-- 1. Shop Wallets RLS
-- Allow admins to see all shop wallets
CREATE POLICY "Admins view all shop wallets"
ON public.shop_wallets
FOR SELECT
USING ( public.is_admin() );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_admin_wallet_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins view all shop transaction history' AND tablename = 'shop_wallet_transactions'
    ) THEN
        -- 2. Shop Wallet Transactions RLS
-- Allow admins to see all transactions
CREATE POLICY "Admins view all shop transaction history"
ON public.shop_wallet_transactions
FOR SELECT
USING ( public.is_admin() );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_admin_wallet_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins update shop transactions' AND tablename = 'shop_wallet_transactions'
    ) THEN
        -- Allow admins to update transactions (e.g., approve/reject withdrawals)
CREATE POLICY "Admins update shop transactions"
ON public.shop_wallet_transactions
FOR UPDATE
USING ( public.is_admin() );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_admin_wallet_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage global settings' AND tablename = 'shop_global_settings'
    ) THEN
        -- 3. Shop Global Settings RLS
-- Ensure admins can manage global settings if not already covered
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shop_global_settings' AND policyname = 'Admins manage global settings'
  ) THEN
    CREATE POLICY "Admins manage global settings"
    ON public.shop_global_settings
    FOR ALL
    USING ( public.is_admin() );
  END IF;
END
$$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_admin_wallet_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view global settings' AND tablename = 'shop_global_settings'
    ) THEN
        -- Allow authenticated users to read global settings (needed for storefronts and dashboards)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shop_global_settings' AND policyname = 'Anyone can view global settings'
  ) THEN
    CREATE POLICY "Anyone can view global settings"
    ON public.shop_global_settings
    FOR SELECT
    TO authenticated, anon
    USING ( true );
  END IF;
END
$$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin read access to admin settings' AND tablename = 'admin_settings'
    ) THEN
        -- Only admins can read settings
CREATE POLICY "Admin read access to admin settings"
ON public.admin_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access to phone blacklist' AND tablename = 'phone_blacklist'
    ) THEN
        -- Admins can do everything
CREATE POLICY "Admin full access to phone blacklist"
ON public.phone_blacklist
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
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_rls_security.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can check blacklist' AND tablename = 'phone_blacklist'
    ) THEN
        -- Authenticated users can only check if a number is blacklisted (read-only)
-- This allows the system to validate phone numbers during signup/order
CREATE POLICY "Authenticated users can check blacklist"
ON public.phone_blacklist
FOR SELECT
TO authenticated
USING (true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/repair_shop_system.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_orders_public_read' AND tablename = 'shop_orders'
    ) THEN
        CREATE POLICY "shop_orders_public_read" ON public.shop_orders
    FOR SELECT TO anon, authenticated USING (true); -- Guest status tracking
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_shop_orders_fetch.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_profiles_owner_read' AND tablename = 'shop_profiles'
    ) THEN
        CREATE POLICY "shop_profiles_owner_read" ON public.shop_profiles
    FOR SELECT TO authenticated
    USING (owner_id = auth.uid());
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_orders_owner_read' AND tablename = 'shop_orders'
    ) THEN
        -- Shop orders: owners can read their shop's orders; public can read by phone (for status page)
CREATE POLICY "shop_orders_owner_read" ON public.shop_orders
  FOR SELECT USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_shop_pricing_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_pricing_admin_write' AND tablename = 'shop_pricing'
    ) THEN
        CREATE POLICY "shop_pricing_admin_write" ON public.shop_pricing
  FOR ALL USING (public.is_admin());
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_shop_pricing_rls.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_pricing_owner_read' AND tablename = 'shop_pricing'
    ) THEN
        CREATE POLICY "shop_pricing_owner_read" ON public.shop_pricing
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid()
    )
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_wallet_payments_policy.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own wallet payments' AND tablename = 'wallet_payments'
    ) THEN
        -- Users can view their own payment records
CREATE POLICY "Users can view own wallet payments"
ON public.wallet_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wallets
    WHERE wallets.id = wallet_payments.wallet_id
    AND wallets.user_id = auth.uid()
  )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_wallet_payments_policy.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all wallet payments' AND tablename = 'wallet_payments'
    ) THEN
        -- Admins can view all payment records
CREATE POLICY "Admins can view all wallet payments"
ON public.wallet_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'sub-admin')
  )
);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_profiles_owner_all' AND tablename = 'shop_profiles'
    ) THEN
        -- Shop profiles: owners can read/update their own; public can read approved shops
CREATE POLICY "shop_profiles_owner_all" ON public.shop_profiles
  FOR ALL USING (auth.uid() = owner_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_pricing_owner_all' AND tablename = 'shop_pricing'
    ) THEN
        -- Shop pricing: owners manage their own; public can read pricing for approved shops
CREATE POLICY "shop_pricing_owner_all" ON public.shop_pricing
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid())
  );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_wallets_owner_read' AND tablename = 'shop_wallets'
    ) THEN
        -- Shop wallets: owners can only read their own
CREATE POLICY "shop_wallets_owner_read" ON public.shop_wallets
  FOR SELECT USING (owner_id = auth.uid());
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_schema.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_announcements_public_read' AND tablename = 'shop_announcements'
    ) THEN
        CREATE POLICY "shop_announcements_public_read" ON public.shop_announcements
  FOR SELECT USING (is_active = true);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_storage_policy.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Shop Logos' AND tablename = 'objects'
    ) THEN
        -- 3. Policy: Public Read Access
-- Anyone can view shop logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Shop Logos'
  ) THEN
    CREATE POLICY "Public Access Shop Logos"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'shop-logos' );
  END IF;
END
$$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_storage_policy.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Auth Upload Shop Logos' AND tablename = 'objects'
    ) THEN
        -- 4. Policy: Authenticated Upload
-- Users can upload files to their own folder: shop-logos/{uid}/{filename}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth Upload Shop Logos'
  ) THEN
    CREATE POLICY "Auth Upload Shop Logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'shop-logos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END
$$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_storage_policy.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Auth Update Shop Logos' AND tablename = 'objects'
    ) THEN
        -- 5. Policy: Authenticated Update
-- Users can update their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth Update Shop Logos'
  ) THEN
    CREATE POLICY "Auth Update Shop Logos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'shop-logos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END
$$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_storage_policy.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Auth Delete Shop Logos' AND tablename = 'objects'
    ) THEN
        -- 6. Policy: Authenticated Delete
-- Users can delete their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth Delete Shop Logos'
  ) THEN
    CREATE POLICY "Auth Delete Shop Logos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'shop-logos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END
$$;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_withdrawal_improvements.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Owners can view their own payment details' AND tablename = 'shop_payment_details'
    ) THEN
        CREATE POLICY "Owners can view their own payment details"
    ON public.shop_payment_details FOR SELECT
    USING (auth.uid() = shop_owner_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_withdrawal_improvements.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert their own payment details' AND tablename = 'shop_payment_details'
    ) THEN
        CREATE POLICY "Owners can insert their own payment details"
    ON public.shop_payment_details FOR INSERT
    WITH CHECK (auth.uid() = shop_owner_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_withdrawal_improvements.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update their own payment details' AND tablename = 'shop_payment_details'
    ) THEN
        CREATE POLICY "Owners can update their own payment details"
    ON public.shop_payment_details FOR UPDATE
    USING (auth.uid() = shop_owner_id)
    WITH CHECK (auth.uid() = shop_owner_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_withdrawal_improvements.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Owners can delete their own payment details' AND tablename = 'shop_payment_details'
    ) THEN
        CREATE POLICY "Owners can delete their own payment details"
    ON public.shop_payment_details FOR DELETE
    USING (auth.uid() = shop_owner_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;

-- Source: supabase/shop_withdrawal_improvements.sql
DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all payment details' AND tablename = 'shop_payment_details'
    ) THEN
        CREATE POLICY "Admins can view all payment details"
    ON public.shop_payment_details FOR SELECT
    USING (public.is_admin());
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;



-- ==================================================
-- 12. GRANTS & REVOKES
-- ==================================================

-- Source: supabase/migrations/20260406_fix_rls_vulnerabilities.sql
-- 1e. Revoke the overly broad table-level SELECT grant that was applied
--     in repair_shop_system.sql ("GRANT SELECT ON ALL TABLES TO anon").
--     We revoke granularly; other tables keep their grants.
REVOKE SELECT ON public.shop_orders FROM anon;

-- Source: supabase/migrations/20260406_fix_rls_vulnerabilities.sql
-- 2d. Revoke any direct table-level grants to anon/authenticated
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.phone_blacklist FROM anon;

-- Source: supabase/migrations/20260406_fix_rls_vulnerabilities.sql
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.phone_blacklist FROM authenticated;

-- Source: supabase/migrations/20260406_fix_rls_vulnerabilities.sql
-- Re-grant only what RLS will enforce via the policy above
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_blacklist TO authenticated;

-- Source: supabase/migrations/20260422_security_hardening_p0.sql
-- Restore SELECT grant for authenticated users (admins access via RLS on afa_orders)
GRANT SELECT ON public.afa_registrations TO authenticated;

-- Source: supabase/migrations/20260508_public_safe_settings_and_shop_lookup.sql
grant select on public.public_admin_settings to anon, authenticated;

-- Source: supabase/migrations/20260508_public_safe_settings_and_shop_lookup.sql
grant execute on function public.get_shop_order_by_phone_reference(text, text) to anon, authenticated;

-- Source: supabase/migrations/20260508_public_safe_settings_and_shop_lookup.sql
revoke execute on function public.get_shop_orders_by_phone(text, int) from anon, authenticated;

-- Source: supabase/migrations/20260527_explicit_api_grants.sql
-- ============================================================
-- ARHMS DATA LTD — Explicit API Grants Migration (Safe Version)
-- Prepared for: Supabase Data API defaults change (May 30 / Oct 30 2026)
--
-- This script dynamically grants permissions ONLY on tables that
-- actually exist in the live database. It will never fail due to
-- a missing table.
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE
    tbl TEXT;
    -- Tables that should also be readable by anonymous (public-facing)
    anon_readable TEXT[] := ARRAY[
        'users',
        'data_packages',
        'shop_profiles',
        'shop_global_settings',
        'shop_pricing',
        'shop_announcements',
        'shop_rc_pricing',
        'results_checker_types',
        'system_announcements'
    ];
BEGIN
    -- Loop through every table in the public schema that actually exists
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
    LOOP
        -- Grant full CRUD to authenticated users (RLS controls row-level access)
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',
            tbl
        );

        -- Grant all privileges to service_role (server-side bypass)
        EXECUTE format(
            'GRANT ALL ON public.%I TO service_role',
            tbl
        );

        -- Grant SELECT to anon only for public-facing tables
        IF tbl = ANY(anon_readable) THEN
            EXECUTE format(
                'GRANT SELECT ON public.%I TO anon',
                tbl
            );
        END IF;

        RAISE NOTICE 'Granted permissions on: %', tbl;
    END LOOP;

    -- Grant sequence usage (for auto-increment IDs)
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
    GRANT ALL           ON ALL SEQUENCES IN SCHEMA public TO service_role;

    RAISE NOTICE '✅ All grants applied successfully. Project is future-proofed for Supabase API changes.';
END
$$;

-- Source: supabase/add_announcements_schema.sql
-- 5. Permissions
GRANT SELECT ON public.shop_announcements TO anon, authenticated;

-- Source: supabase/add_announcements_schema.sql
GRANT ALL ON public.shop_announcements TO service_role;

-- Source: supabase/adjust_shop_pricing_for_role_change.sql
-- Grant execution rights to the service role (used by the Next.js API)
GRANT EXECUTE ON FUNCTION adjust_shop_pricing_for_role_change(UUID, TEXT, TEXT) TO service_role;

-- Source: supabase/dashboard_stats_optimizations.sql
-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- Source: supabase/dashboard_stats_optimizations.sql
GRANT EXECUTE ON FUNCTION public.get_user_dashboard_stats(UUID) TO authenticated;

-- Source: supabase/fix_admin_permissions_robust.sql
-- 4. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Source: supabase/fix_admin_permissions_robust.sql
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- Source: supabase/fix_resubmission_rpc.sql
-- Grant execute to authenticated users only (not anon)
REVOKE ALL ON FUNCTION public.resubmit_withdrawal(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

-- Source: supabase/fix_resubmission_rpc.sql
GRANT EXECUTE ON FUNCTION public.resubmit_withdrawal(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Source: supabase/fix_shop_guest_access_v2.sql
-- Migration: Comprehensive fix for Shop Guest Access
-- 1. Ensure anonymous role has usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Source: supabase/fix_shop_guest_access_v2.sql
-- 2. Grant SELECT access to anon/authenticated for shop tables
GRANT SELECT ON public.shop_orders TO anon, authenticated;

-- Source: supabase/fix_shop_guest_access_v2.sql
GRANT SELECT ON public.shop_profiles TO anon, authenticated;

-- Source: supabase/fix_shop_orders_fetch.sql
-- ============================================================
-- SHOP ORDERS FIX — Run this once in Supabase SQL Editor
-- Fixes: storefront order tracker + shop orders dashboard
-- ============================================================

-- 1. Ensure anon/authenticated can call the order-tracking RPC
--    (Without this, unauthenticated visitors get a permission error)
GRANT EXECUTE ON FUNCTION public.get_shop_orders_by_phone(text, int) TO anon;

-- Source: supabase/fix_shop_orders_fetch.sql
GRANT EXECUTE ON FUNCTION public.get_shop_orders_by_phone(text, int) TO authenticated;

-- Source: supabase/profit_stats_rpc_grants.sql
-- Revoke default public execute permissions
REVOKE EXECUTE ON FUNCTION public.get_profit_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM PUBLIC;

-- Source: supabase/profit_stats_rpc_grants.sql
REVOKE EXECUTE ON FUNCTION public.get_profit_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM anon;

-- Source: supabase/profit_stats_rpc_grants.sql
GRANT EXECUTE ON FUNCTION public.get_profit_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Source: supabase/profit_stats_rpc_grants.sql
GRANT EXECUTE ON FUNCTION public.get_profit_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO service_role;

-- Source: supabase/profit_stats_rpc_grants.sql
REVOKE EXECUTE ON FUNCTION public.get_profit_timeseries(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM PUBLIC;

-- Source: supabase/profit_stats_rpc_grants.sql
REVOKE EXECUTE ON FUNCTION public.get_profit_timeseries(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM anon;

-- Source: supabase/profit_stats_rpc_grants.sql
GRANT EXECUTE ON FUNCTION public.get_profit_timeseries(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Source: supabase/profit_stats_rpc_grants.sql
GRANT EXECUTE ON FUNCTION public.get_profit_timeseries(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO service_role;

-- Source: supabase/profit_stats_rpc_grants.sql
REVOKE EXECUTE ON FUNCTION public.get_shop_owner_stats() FROM PUBLIC;

-- Source: supabase/profit_stats_rpc_grants.sql
REVOKE EXECUTE ON FUNCTION public.get_shop_owner_stats() FROM anon;

-- Source: supabase/profit_stats_rpc_grants.sql
GRANT EXECUTE ON FUNCTION public.get_shop_owner_stats() TO authenticated;

-- Source: supabase/profit_stats_rpc_grants.sql
GRANT EXECUTE ON FUNCTION public.get_shop_owner_stats() TO service_role;

-- Source: supabase/profit_stats_rpc_grants.sql
REVOKE EXECUTE ON FUNCTION public.get_wallet_overview() FROM PUBLIC;

-- Source: supabase/profit_stats_rpc_grants.sql
REVOKE EXECUTE ON FUNCTION public.get_wallet_overview() FROM anon;

-- Source: supabase/profit_stats_rpc_grants.sql
GRANT EXECUTE ON FUNCTION public.get_wallet_overview() TO authenticated;

-- Source: supabase/profit_stats_rpc_grants.sql
GRANT EXECUTE ON FUNCTION public.get_wallet_overview() TO service_role;

-- Source: supabase/repair_shop_system.sql
-- 3. PERMISSIONS REPAIR: Ensure all roles have correct usage and select access
-- This fixes "406 Not Acceptable" errors by ensuring roles can "see" the tables.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Source: supabase/repair_shop_system.sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Source: supabase/repair_shop_system.sql
-- 6. SYSTEM ANNOUNCEMENTS (Fixing the 406 for this table too)
GRANT SELECT ON public.system_announcements TO anon, authenticated;



-- ==================================================
-- 13. PROCEDURAL BLOCKS
-- ==================================================

-- Source: supabase/migrations/20260412_moolre_withdrawals.sql
DO $idempotent_block$
BEGIN
    -- ─── status constraint update ─────────────────────────────────────────────────
-- Drop any existing check constraint on status so we can re-create it cleanly.
-- The new allowed values are: pending, moolre_pending, completed
DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    SELECT conname INTO v_constraint
    FROM pg_constraint
    WHERE conrelid = 'public.shop_wallet_transactions'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%';

    IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.shop_wallet_transactions DROP CONSTRAINT %I', v_constraint);
    END IF;
END;
$$;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260422_security_hardening_p1_p3.sql
DO $idempotent_block$
BEGIN
    -- ============================================================================
-- SECURITY HARDENING — P1 to P3 FIXES
-- Date: 2026-04-22
-- Covers:
--   - WARN-01 to WARN-21 (search_path injection)
--   - WARN-22 to WARN-23 (public bucket allows listing)
--   - INFO-01 (shop_pricing_logs no policy)
-- ============================================================================

-- ============================================================================
-- P1 FIX — WARN-01 to WARN-21: Function Search Path Mutable
-- Secures all SECURITY DEFINER functions by setting search_path = ''
-- to prevent search path injection attacks.
-- Applied dynamically to the audited function names.
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT
            p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND p.proname IN (
              'deduct_wallet_balance',
              'protect_shop_pricing_updates',
              'auto_update_shop_pricing_on_platform_cost',
              'get_profit_summary',
              'get_profit_timeseries',
              'get_shop_owner_stats',
              'get_wallet_overview',
              'process_afa_order',
              'adjust_shop_pricing_for_role_change',
              'update_conversation_last_message',
              'get_admin_dashboard_stats',
              'get_user_dashboard_stats',
              'delete_shop_data',
              'protect_shop_admin_columns',
              'handle_new_user',
              'handle_new_user_wallet',
              'enforce_single_default_payment',
              'get_user_transactions_with_balance',
              'get_shop_orders_by_phone',
              'enforce_max_payment_details',
              'sync_shop_order_status_from_orders'
          )
    LOOP
        EXECUTE 'ALTER FUNCTION ' || func_record.func_signature || ' SET search_path = ''''';
    END LOOP;
END;
$$;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/push_subscriptions.sql
DO $idempotent_block$
BEGIN
    DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions' AND policyname = 'own subscriptions'
  ) THEN
    EXECUTE 'CREATE POLICY "own subscriptions" ON push_subscriptions
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/sync_shop_orders_trigger.sql
DO $idempotent_block$
BEGIN
    -- Output confirmation
DO $$
BEGIN
  RAISE NOTICE 'Order status sync trigger installed and existing desynced records backfilled successfully.';
END $$;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;



-- ==================================================
-- 14. SEED DATA
-- ==================================================

-- Source: supabase/schema.sql
-- Insert default admin settings
INSERT INTO public.admin_settings (key, value) VALUES
  ('paystack_fee_percent', '1.95'),
  ('auto_fulfillment_enabled', 'true'),
  ('support_whatsapp', '""'),
  ('support_email', '"arhmsghltd@gmail.com"'),
  ('support_phone', '""'),
  ('announcement_enabled', 'false'),
  ('announcement_title', '""'),
  ('announcement_message', '""'),
  ('mtn_price_adjustment', '0'),
  ('telecel_price_adjustment', '0'),
  ('airteltigo_price_adjustment', '0')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/schema.sql
-- Sample data packages
INSERT INTO public.data_packages (network, size, price, cost_price, description, sort_order) VALUES
  ('MTN', '1GB', 5.00, 4.00, '1GB data valid for 30 days', 1),
  ('MTN', '2GB', 10.00, 8.00, '2GB data valid for 30 days', 2),
  ('MTN', '5GB', 20.00, 16.00, '5GB data valid for 30 days', 3),
  ('MTN', '10GB', 35.00, 30.00, '10GB data valid for 30 days', 4),
  ('Telecel', '1GB', 5.50, 4.50, '1GB data valid for 30 days', 1),
  ('Telecel', '2GB', 10.50, 9.00, '2GB data valid for 30 days', 2),
  ('Telecel', '5GB', 22.00, 18.00, '5GB data valid for 30 days', 3),
  ('AT-iShare', '1GB', 5.00, 4.00, '1GB data valid for 30 days', 1),
  ('AT-iShare', '2GB', 10.00, 8.00, '2GB data valid for 30 days', 2),
  ('AT-BigTime', '5GB', 25.00, 20.00, '5GB BigTime data', 1),
  ('AT-BigTime', '10GB', 45.00, 36.00, '10GB BigTime data', 2)
ON CONFLICT DO NOTHING;

-- Source: supabase/migrations/20260328_create_shop_banners_bucket.sql
-- Enable public access to the shop-banners bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-banners', 'shop-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Source: supabase/migrations/20260515_cron_job_settings.sql
-- Add default cron job settings to admin_settings table

INSERT INTO public.admin_settings (key, value)
VALUES
    ('cron_auto_refulfill_enabled', 'false'),
    ('cron_auto_refulfill_delay_minutes', '5'),
    ('cron_auto_complete_enabled', 'false'),
    ('cron_auto_complete_delay_minutes', '30')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/migrations/20260528_developer_api.sql
-- ─── Admin settings ───────────────────────────────────────────────────────────
INSERT INTO public.admin_settings (key, value) VALUES
    ('api_feature_enabled', 'true'),
    ('api_allowed_roles',   '["agent","admin","sub-admin"]'),
    ('api_rate_limits',     '{"purchase":20,"bulk":10,"balance":60,"status":60}')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/migrations/20260528_developer_api.sql
-- Ensure admin/sub-admin are always in the allowed roles list (idempotent upsert)
INSERT INTO public.admin_settings (key, value) VALUES ('api_allowed_roles', '["agent","admin","sub-admin"]')
ON CONFLICT (key) DO UPDATE SET value = '["agent","admin","sub-admin"]';

-- Source: supabase/migrations/20260529_dealership_role.sql
-- Seed admin_settings keys for dealer subscription pricing and auto-upgrade toggle
INSERT INTO admin_settings (key, value)
VALUES
  ('dealer_subscription_price_6m', '299.99'),
  ('auto_upgrade_expired_dealers', 'false')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/migrations/20260530_dealer_3m_price.sql
-- Seed 3-month dealer subscription price
INSERT INTO admin_settings (key, value)
VALUES ('dealer_subscription_price_3m', '169.99')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/migrations/20260530_dealer_pricing_extensions.sql
-- Seed afa_price_dealer in admin_settings
INSERT INTO admin_settings (key, value)
VALUES ('afa_price_dealer', '15')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/migrations/20260530_dealer_pricing_extensions.sql
-- Seed dealer-specific shop_global_settings (mirrors existing customer/agent pattern)
INSERT INTO shop_global_settings (key, value)
VALUES
  ('shop_paystack_fee_percent_dealer', to_jsonb(1.50)),
  ('withdrawal_fee_percent_dealer',    to_jsonb(3.0)),
  ('withdrawal_fee_flat_dealer',       to_jsonb(0.0)),
  ('min_withdrawal_amount_dealer',     to_jsonb(30.0))
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/migrations/20260530_dealer_promo_toggle.sql
-- Seed dealer_promo_enabled toggle (default OFF)
INSERT INTO admin_settings (key, value)
VALUES ('dealer_promo_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/migrations/20260530_payment_provider_toggle.sql
-- Payment provider toggle settings
-- Allows switching between Moolre and Paystack at runtime without redeployment.
-- active_payment_provider_web  → controls wallet top-ups, agent upgrades, RC vouchers
-- active_payment_provider_shop → controls shop storefront orders

INSERT INTO admin_settings (key, value)
VALUES
  ('active_payment_provider_web',  '"moolre"'),
  ('active_payment_provider_shop', '"moolre"')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/add_price_strikethrough.sql
-- Migration to support old prices and strikethrough display control
-- This enables admin to toggle price strikethrough and stores old prices (2 versions max)

-- Add columns to admin_settings for old prices and strikethrough toggle
INSERT INTO public.admin_settings (key, value) VALUES
  ('agent_upgrade_price_3d_old', '0'),
  ('agent_upgrade_price_14d_old', '0'),
  ('agent_upgrade_price_30d_old', '0'),
  ('show_price_strikethrough', 'false')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/airtime_migration.sql
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

-- Source: supabase/backfill_shop_orders_to_orders.sql
DO $idempotent_block$
BEGIN
    -- Step 1: BACKFILL (Insert missing mirrors)
INSERT INTO public.orders (
    user_id,
    phone_number,
    network,
    size,
    price,
    cost_price,
    status,
    payment_status,
    reference_code,
    fulfillment_method,
    shop_name,
    shop_order_id,
    created_at,
    updated_at
)
SELECT
    sp.owner_id AS user_id,                   -- Link to shop owner for admin visibility
    so.guest_phone AS phone_number,
    so.network,
    so.package_size AS size,
    so.selling_price AS price,
    so.cost_price,
    so.status,
    'paid' AS payment_status,
    CASE
        WHEN so.paystack_reference IS NOT NULL
        THEN 'SHOP-' || RIGHT(so.paystack_reference, 10)
        ELSE 'SHOP-BF-' || LEFT(so.id::text, 8)
    END AS reference_code,
    'auto' AS fulfillment_method,
    sp.shop_name,
    so.id AS shop_order_id,
    so.created_at,
    so.updated_at
FROM public.shop_orders so
JOIN public.shop_profiles sp ON sp.id = so.shop_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.orders o WHERE o.shop_order_id = so.id
)
AND so.status IN ('pending', 'processing', 'completed', 'refunded');
EXCEPTION
    WHEN unique_violation THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/dual_fee_config_migration.sql
-- ============================================================
-- Migration: Dual Customer/Agent Fee Configuration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add new role-specific global settings keys
-- These new keys drive per-role fee resolution.
-- The old singular keys remain as passive fallbacks.
INSERT INTO public.shop_global_settings (key, value, updated_at) VALUES
  ('withdrawal_fee_percent_customer', '5.0',  NOW()),
  ('withdrawal_fee_percent_agent',    '3.0',  NOW()),
  ('withdrawal_fee_flat_customer',    '0.0',  NOW()),
  ('withdrawal_fee_flat_agent',       '0.0',  NOW()),
  ('shop_paystack_fee_percent_customer', '1.95', NOW()),
  ('shop_paystack_fee_percent_agent',    '1.50', NOW()),
  ('min_withdrawal_amount_customer',  '50.0', NOW()),
  ('min_withdrawal_amount_agent',     '30.0', NOW())
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/shop_schema.sql
-- Insert default global settings
INSERT INTO public.shop_global_settings (key, value) VALUES
  ('withdrawal_fee_percent', '5.0'),
  ('withdrawal_fee_flat', '0.0'),
  ('shop_paystack_fee_percent', '1.95'),
  ('min_withdrawal_amount', '10.0'),
  ('fulfillment_mode_default', '"auto"'),
  ('shop_feature_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Source: supabase/shop_storage_policy.sql
-- ============================================================
-- Fix Shop Logos Storage Bucket
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-logos', 'shop-logos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- Source: supabase/triggers.sql
DO $idempotent_block$
BEGIN
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
EXCEPTION
    WHEN unique_violation THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;



-- ==================================================
-- 15. DATA MUTATIONS
-- ==================================================

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DO $idempotent_block$
BEGIN
    -- Backfill role_at_time from current users.role (best-effort for historical data)
UPDATE public.orders o
SET role_at_time = u.role
FROM public.users u
WHERE u.id = o.user_id AND o.role_at_time IS NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DO $idempotent_block$
BEGIN
    -- Backfill cost_price_at_time where 0 (best-effort using network + size)
UPDATE public.orders o
SET cost_price_at_time = dp.cost_price
FROM public.data_packages dp
WHERE dp.network = o.network AND dp.size = o.size
  AND (o.cost_price_at_time IS NULL OR o.cost_price_at_time = 0)
  AND dp.cost_price > 0;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DO $idempotent_block$
BEGIN
    -- Backfill admin_cost_at_time purely via strict package_id linkage
UPDATE public.shop_orders so
SET admin_cost_at_time = dp.cost_price
FROM public.data_packages dp
WHERE dp.id = so.package_id AND so.admin_cost_at_time IS NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DO $idempotent_block$
BEGIN
    -- Backfill owner_role_at_time
UPDATE public.shop_orders so
SET owner_role_at_time = u.role
FROM public.shop_profiles sp
JOIN public.users u ON u.id = sp.owner_id
WHERE sp.id = so.shop_id AND so.owner_role_at_time IS NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260328_banner_positioning.sql
DO $idempotent_block$
BEGIN
    -- Update existing rows to have default values if null (though IF NOT EXISTS handles it for new columns)
UPDATE shop_profiles SET
banner_pos_x = 50,
banner_pos_y = 50,
banner_zoom = 1
WHERE banner_pos_x IS NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_id_type_and_payment.sql
DO $idempotent_block$
BEGIN
    -- If ghana_card column has data, backfill id_number and id_type
UPDATE public.afa_orders
SET
  id_number = ghana_card,
  id_type = 'Ghana Card'
WHERE ghana_card IS NOT NULL AND id_number IS NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_order_rpc.sql
DO $idempotent_block$
BEGIN
    -- Backfill existing rows so NOT NULL constraint doesn't fail
UPDATE public.afa_orders
    SET reference_code = id::TEXT
    WHERE reference_code IS NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/backfill_balance_snapshots.sql
DO $idempotent_block$
BEGIN
    -- BACKFILL: Calculate and populate balance_snapshot for historical transactions
-- This script reconstructs the wallet balance history by working backwards
-- from the current wallet balance.

DO $$
DECLARE
    wallet_record RECORD;
    trans_record RECORD;
    current_calc_balance NUMERIC;
BEGIN
    -- Loop through each wallet
    FOR wallet_record IN SELECT id, balance FROM shop_wallets LOOP
        current_calc_balance := wallet_record.balance;

        -- Loop through ALL transactions for this wallet in reverse chronological order
        FOR trans_record IN
            SELECT id, type, amount, status
            FROM shop_wallet_transactions
            WHERE shop_wallet_id = wallet_record.id
            ORDER BY created_at DESC, id DESC
        LOOP
            -- If it's a withdrawal and it was PENDING or COMPLETED,
            -- it means it WAS deducted from the balance.
            -- To go BACKWARDS in time, we RE-ADD the amount if it was a deduction (withdrawal)
            -- or SUBTRACT it if it was an addition (profit).

            -- IMPORTANT: We only care about transactions that actually affected the balance.
            -- Current logic:
            -- - Withdrawals (Pending/Completed/Rejected) have been deducted.
            -- - Profit (Completed) have been added.

            IF trans_record.type = 'withdrawal' THEN
                -- If the status is NOT rejected (meaning it stayed deducted)
                -- OR if it's already rejected but the money wasn't restored yet (old logic)
                -- we add it back to find previous state.
                current_calc_balance := current_calc_balance + trans_record.amount;

                -- Update the snapshot for this withdrawal
                -- (Note: current_calc_balance here is the balance AFTER the deduction occurred)
                -- Wait, the snapshot should be the balance REMAINING after the request.
                -- So if current balance is 100 and last trans was -20 withdrawal,
                -- previous balance was 120. Snapshot for that -20 is 100.
                UPDATE shop_wallet_transactions
                SET balance_snapshot = (current_calc_balance - trans_record.amount)
                WHERE id = trans_record.id;

            ELSIF trans_record.type = 'profit' AND trans_record.status = 'completed' THEN
                -- Subtract profit to go backwards
                current_calc_balance := current_calc_balance - trans_record.amount;
            END IF;
        END LOOP;
    END LOOP;
END $$;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/backfill_shop_orders_to_orders.sql
DO $idempotent_block$
BEGIN
    -- Step 2: UPDATE (Fix existing mirrored orders that have NULL user_id)
UPDATE public.orders o
SET user_id = sp.owner_id
FROM public.shop_orders so
JOIN public.shop_profiles sp ON sp.id = so.shop_id
WHERE o.shop_order_id = so.id
  AND o.user_id IS NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_negative_balances.sql
DO $idempotent_block$
BEGIN
    -- 1. Reset Negative Current Balances to 0
UPDATE public.shop_wallets
SET balance = 0, updated_at = NOW()
WHERE balance < 0;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/fix_negative_balances.sql
DO $idempotent_block$
BEGIN
    -- 2. Reset Negative Total Earned to 0 (Just in case)
UPDATE public.shop_wallets
SET total_earned = 0, updated_at = NOW()
WHERE total_earned < 0;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migration_fix_roles.sql
DO $idempotent_block$
BEGIN
    -- Step 2: Update existing users with role 'user' to 'customer' BEFORE adding new constraint
UPDATE public.users
SET role = 'customer'
WHERE role = 'user';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migration_fix_roles.sql
DO $idempotent_block$
BEGIN
    -- Step 3: Update any other invalid roles to 'customer' (safety measure)
UPDATE public.users
SET role = 'customer'
WHERE role NOT IN ('customer', 'agent', 'sub-admin', 'admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/repair_shop_system.sql
DO $idempotent_block$
BEGIN
    -- 5. BACKFILL: Link existing mirrored orders to shop orders via reference mapping
UPDATE public.orders o
SET shop_order_id = sho.id,
    shop_name = s.shop_name
FROM public.shop_orders sho
JOIN public.shop_profiles s ON s.id = sho.shop_id
WHERE o.reference_code = 'SHOP-' || RIGHT(sho.paystack_reference, 8)
  AND o.shop_order_id IS NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/revert_and_fix_shop_profit.sql
DO $idempotent_block$
BEGIN
    -- 1. Revert Wallet Balances (Remove all profit credited so far)
-- We calculate the total profit per wallet and subtract it
WITH profit_summary AS (
  SELECT shop_wallet_id, SUM(amount) as total_profit
  FROM shop_wallet_transactions
  WHERE type = 'profit'
  GROUP BY shop_wallet_id
)
UPDATE shop_wallets sw
SET
  balance = sw.balance - ps.total_profit,
  total_earned = sw.total_earned - ps.total_profit,
  updated_at = NOW()
FROM profit_summary ps
WHERE sw.id = ps.shop_wallet_id;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/revert_and_fix_shop_profit.sql
DO $idempotent_block$
BEGIN
    -- 2. Delete the Profit Transactions
-- This allows them to be re-credited correctly later (idempotency check won't block)
DELETE FROM shop_wallet_transactions WHERE type = 'profit';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/revert_and_fix_shop_profit.sql
DO $idempotent_block$
BEGIN
    -- 3. Fix the Cost Price & Profit on existing Shop Orders
-- (Switch from Admin Cost to Shop Cost/Price)
UPDATE shop_orders so
SET
  cost_price = dp.price,
  profit = so.selling_price - dp.price
FROM data_packages dp
WHERE so.package_id = dp.id;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/sync_shop_orders_trigger.sql
DO $idempotent_block$
BEGIN
    -- 4. Automatically backfill/fix any existing desynced orders
-- This looks at all orders with a shop_order_id, and if their status doesn't match the
-- linked shop_orders.status, it updates shop_orders to match the main orders table.
UPDATE shop_orders so
SET
    status = o.status,
    updated_at = NOW()
FROM orders o
WHERE o.shop_order_id = so.id
  AND o.status IS DISTINCT FROM so.status;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;



-- ==================================================
-- 16. OTHER ALTERS
-- ==================================================

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
DO $idempotent_block$
BEGIN
    -- Add Constraints idempotently
ALTER TABLE public.shop_pricing DROP CONSTRAINT IF EXISTS check_profit_margin_range;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_auto_update_shop_pricing.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE public.shop_pricing DROP CONSTRAINT IF EXISTS unique_shop_package;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260318_profit_dashboard_schema.sql
DO $idempotent_block$
BEGIN
    -- ============================================================================
-- 1. ORDERS TABLE (MAIN PLATFORM)
-- Rename cost_price to cost_price_at_time and add role tracking
-- ============================================================================

-- Rename cost_price to clarify it is a snapshot (safe, preserves data)
ALTER TABLE public.orders RENAME COLUMN cost_price TO cost_price_at_time;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260325_shop_airtime.sql
DO $idempotent_block$
BEGIN
    -- 2. Make package_id nullable in shop_orders since airtime orders don't use it
ALTER TABLE shop_orders
ALTER COLUMN package_id DROP NOT NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260422_security_hardening_p4.sql
DO $idempotent_block$
BEGIN
    -- ============================================================================
-- SECURITY HARDENING — P4 FIXES (Trigger Functions)
-- Date: 2026-04-22
-- Covers: Search Path Injection warnings on non-SECURITY DEFINER trigger functions
-- ============================================================================

ALTER FUNCTION public.update_conversation_last_message() SET search_path = '';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260422_security_hardening_p4.sql
DO $idempotent_block$
BEGIN
    ALTER FUNCTION public.enforce_single_default_payment() SET search_path = '';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260422_security_hardening_p4.sql
DO $idempotent_block$
BEGIN
    ALTER FUNCTION public.enforce_max_payment_details() SET search_path = '';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260528_add_kingflexy_fulfillment_method.sql
DO $idempotent_block$
BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migrations/20260529_dealership_role.sql
DO $idempotent_block$
BEGIN
    -- Add 'dealer' to role check constraint on users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/add_afa_order_rpc.sql
DO $idempotent_block$
BEGIN
    -- Now enforce NOT NULL and UNIQUE
ALTER TABLE public.afa_orders
    ALTER COLUMN reference_code SET NOT NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/backfill_shop_orders_to_orders.sql
DO $idempotent_block$
BEGIN
    -- ============================================================
-- Backfill: Mirror unmirrored shop_orders into the orders table
--
-- Run this in Supabase SQL Editor.
-- Safe to re-run:
-- 1. Inserts missing mirrors
-- 2. Updates existing mirrors to link to shop owner (fixes N/A purchaser)
-- ============================================================

-- Step 0: Ensure user_id can be NULL (for safety, though we are now linking to owner)
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    -- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/chat_schema.sql
DO $idempotent_block$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migration_fix_roles.sql
DO $idempotent_block$
BEGIN
    -- Migration: Fix User Role Assignment
-- This migration updates the role system to use 'customer', 'agent', 'sub-admin', 'admin'
-- instead of the old 'user', 'admin' system

-- Step 1: Drop the existing constraint on the role column
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/migration_fix_roles.sql
DO $idempotent_block$
BEGIN
    -- Step 4: Update the default value for new users
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'customer';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;

-- Source: supabase/push_subscriptions.sql
DO $idempotent_block$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;



-- ==================================================
-- 17. COMMENTS
-- ==================================================

-- Source: supabase/migrations/20260508_public_safe_settings_and_shop_lookup.sql
comment on view public.public_admin_settings is
  'Public-safe allowlist of admin_settings keys consumed by /api/public/config. whatsapp_admin_number is intentionally public for customer support escalation.';

-- Source: supabase/add_agent_expires_at.sql
-- Add a comment to document the column
COMMENT ON COLUMN public.users.agent_expires_at IS 'Timestamp when agent role access expires. NULL means no expiration or not an agent.';



-- ==================================================
-- 18. NOTIFICATIONS
-- ==================================================

-- Source: supabase/add_pricing_approval.sql
-- 7. Refresh schema cache
NOTIFY pgrst, 'reload schema';
