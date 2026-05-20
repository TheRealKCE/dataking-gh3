-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_rc_types_active
  ON public.results_checker_types(display_order)
  WHERE is_active = true;

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

-- Optimize FIFO searches for available stock
CREATE INDEX IF NOT EXISTS idx_rc_inv_available
  ON public.results_checker_inventory(type_id, created_at ASC)
  WHERE status = 'available';

-- Optimize reservation cleanups
CREATE INDEX IF NOT EXISTS idx_rc_inv_reserved_expiry
  ON public.results_checker_inventory(reservation_expires_at)
  WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS idx_rc_inv_type_status
  ON public.results_checker_inventory(type_id, status);

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

CREATE INDEX IF NOT EXISTS idx_rc_orders_user ON public.results_checker_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_rc_orders_status ON public.results_checker_orders(status, payment_status);
CREATE INDEX IF NOT EXISTS idx_rc_orders_ref ON public.results_checker_orders(reference_code);
CREATE INDEX IF NOT EXISTS idx_rc_orders_shop ON public.results_checker_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_rc_orders_created ON public.results_checker_orders(created_at DESC);

-- ============================================================================
-- 4. Row-Level Security (RLS) Policies
-- ============================================================================
ALTER TABLE public.results_checker_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results_checker_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results_checker_orders ENABLE ROW LEVEL SECURITY;

-- Product catalogs are readable by everyone, editable only by system admins
DROP POLICY IF EXISTS "rc_types_select_all" ON public.results_checker_types;
CREATE POLICY "rc_types_select_all" ON public.results_checker_types FOR SELECT USING (true);
DROP POLICY IF EXISTS "rc_types_write_admin" ON public.results_checker_types;
CREATE POLICY "rc_types_write_admin" ON public.results_checker_types FOR ALL TO service_role USING (true);

-- Vouchers table is locked down (security sensitive: contains plaintext PINs)
DROP POLICY IF EXISTS "rc_inventory_admin_only" ON public.results_checker_inventory;
CREATE POLICY "rc_inventory_admin_only" ON public.results_checker_inventory FOR ALL USING (auth.role() = 'service_role');

-- Users can only read their own purchase records
DROP POLICY IF EXISTS "rc_orders_user_select" ON public.results_checker_orders;
CREATE POLICY "rc_orders_user_select" ON public.results_checker_orders FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
DROP POLICY IF EXISTS "rc_orders_admin_all" ON public.results_checker_orders;
CREATE POLICY "rc_orders_admin_all" ON public.results_checker_orders FOR ALL USING (auth.role() = 'service_role');

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

