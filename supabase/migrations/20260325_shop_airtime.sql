-- Migration: Add Airtime Fees to Shop Profiles & Adjust RLS
-- Date: 2026-03-25

-- 1. Add airtime fee columns to shop_profiles
ALTER TABLE shop_profiles 
ADD COLUMN IF NOT EXISTS airtime_fee_mtn numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS airtime_fee_telecel numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS airtime_fee_at numeric DEFAULT 0;

-- 2. Make package_id nullable in shop_orders since airtime orders don't use it
ALTER TABLE shop_orders
ALTER COLUMN package_id DROP NOT NULL;

-- 3. Add shop tracking to airtime_orders
ALTER TABLE airtime_orders
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shop_profiles(id),
ADD COLUMN IF NOT EXISTS shop_name TEXT;
