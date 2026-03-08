-- Migration: MTN AFAR Registration Enhancements
-- Adds id_type, id_number, and payment_amount columns to afa_orders
-- Run this in your Supabase SQL Editor

-- Add id_type column (Ghana Card, Passport, Driver's License, Voter ID)
ALTER TABLE public.afa_orders
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(12, 2) DEFAULT 0.00;

-- If ghana_card column has data, backfill id_number and id_type
UPDATE public.afa_orders
SET
  id_number = ghana_card,
  id_type = 'Ghana Card'
WHERE ghana_card IS NOT NULL AND id_number IS NULL;

-- Optionally keep ghana_card for backward compatibility (do not drop it yet)
-- DROP COLUMN ghana_card; -- Uncomment this only after confirming data migration

-- Ensure status values are correct
-- The status check already covers: pending, processing, completed, cancelled
-- No constraint change needed if it was already set correctly.

-- Enable realtime for afa_orders (for admin dashboard live updates)
-- Run this if not already configured in your Supabase dashboard:
-- ALTER TABLE public.afa_orders REPLICA IDENTITY FULL;
