-- ============================================================
-- Migration: Replace old bulk-pricing columns with JSONB array
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Step 1: Drop the old single-threshold columns if they exist
ALTER TABLE results_checker_types
    DROP COLUMN IF EXISTS bulk_quantity_threshold,
    DROP COLUMN IF EXISTS bulk_customer_price,
    DROP COLUMN IF EXISTS bulk_agent_price,
    DROP COLUMN IF EXISTS bulk_dealer_price;

-- Step 2: Add the new JSONB bulk_pricing column
-- Format: [{ "min_qty": 5, "max_qty": 10, "unit_price": 14.00 }, ...]
ALTER TABLE results_checker_types
    ADD COLUMN IF NOT EXISTS bulk_pricing JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Step 3: Ensure cost_price column exists (should already be there)
ALTER TABLE results_checker_types
    ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Step 4: Add a sanity check — selling prices can never drop below cost
-- Note: PostgreSQL cannot directly reference computed JSON values in CHECK constraints,
-- so this constraint only covers the static price columns.
ALTER TABLE results_checker_types
    DROP CONSTRAINT IF EXISTS rc_types_pricing_sanity;

ALTER TABLE results_checker_types
    ADD CONSTRAINT rc_types_pricing_sanity
    CHECK (
        customer_price >= cost_price AND
        agent_price >= cost_price AND
        (dealer_price IS NULL OR dealer_price = 0 OR dealer_price >= cost_price)
    );

-- Step 5: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rc_types_is_active ON results_checker_types(is_active);
CREATE INDEX IF NOT EXISTS idx_rc_types_display_order ON results_checker_types(display_order);
