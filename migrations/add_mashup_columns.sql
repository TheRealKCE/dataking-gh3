-- ============================================================
-- MTN Mashup Feature — DB Migration
-- Adds two columns to airtime_orders to support Mashup orders
-- ============================================================

ALTER TABLE public.airtime_orders
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'airtime'
    CHECK (type IN ('airtime', 'mashup')),
  ADD COLUMN IF NOT EXISTS bundle_preference TEXT
    CHECK (bundle_preference IN ('balanced', 'data', 'voice') OR bundle_preference IS NULL);

-- Index for fast admin filtering by order type
CREATE INDEX IF NOT EXISTS idx_airtime_orders_type
  ON public.airtime_orders (type);

-- Column documentation
COMMENT ON COLUMN public.airtime_orders.type
  IS 'Order type: airtime (default) or mashup (MTN bundle estimation via My MTN App)';
COMMENT ON COLUMN public.airtime_orders.bundle_preference
  IS 'Mashup bundle preference: balanced | data | voice — NULL for standard airtime orders';
