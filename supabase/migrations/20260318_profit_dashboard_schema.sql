-- ============================================================================
-- 1. ORDERS TABLE (MAIN PLATFORM)
-- Rename cost_price to cost_price_at_time and add role tracking
-- ============================================================================

-- Rename cost_price to clarify it is a snapshot (safe, preserves data)
ALTER TABLE public.orders RENAME COLUMN cost_price TO cost_price_at_time;

-- Add column to snapshot the user's role at time of transaction
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS role_at_time TEXT;

-- Backfill role_at_time from current users.role (best-effort for historical data)
UPDATE public.orders o 
SET role_at_time = u.role
FROM public.users u 
WHERE u.id = o.user_id AND o.role_at_time IS NULL;

-- Backfill cost_price_at_time where 0 (best-effort using network + size)
UPDATE public.orders o 
SET cost_price_at_time = dp.cost_price
FROM public.data_packages dp
WHERE dp.network = o.network AND dp.size = o.size
  AND (o.cost_price_at_time IS NULL OR o.cost_price_at_time = 0)
  AND dp.cost_price > 0;

-- ============================================================================
-- 2. SHOP_ORDERS TABLE (SHOP PLATFORM)
-- Add snapshot columns for admin true cost and owner role
-- ============================================================================

-- Snapshot of the admin's true supplier cost at the time of the order
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS admin_cost_at_time DECIMAL(12,2);

-- Snapshot of the shop owner's role at the time of the order
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS owner_role_at_time TEXT;

-- Backfill admin_cost_at_time purely via strict package_id linkage
UPDATE public.shop_orders so 
SET admin_cost_at_time = dp.cost_price
FROM public.data_packages dp 
WHERE dp.id = so.package_id AND so.admin_cost_at_time IS NULL;

-- Backfill owner_role_at_time 
UPDATE public.shop_orders so 
SET owner_role_at_time = u.role
FROM public.shop_profiles sp
JOIN public.users u ON u.id = sp.owner_id
WHERE sp.id = so.shop_id AND so.owner_role_at_time IS NULL;

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

-- Indexes for performance and auditing visibility
CREATE INDEX IF NOT EXISTS idx_profit_logs_type ON public.admin_profit_logs(transaction_type);
CREATE INDEX IF NOT EXISTS idx_profit_logs_loss ON public.admin_profit_logs(is_loss) WHERE is_loss = true;
CREATE INDEX IF NOT EXISTS idx_profit_logs_created ON public.admin_profit_logs(created_at DESC);

-- Index completed statuses for fast RPC analytical queries
CREATE INDEX IF NOT EXISTS idx_orders_completed ON public.orders(created_at DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_shop_orders_completed ON public.shop_orders(created_at DESC) WHERE status = 'completed';

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

DROP TRIGGER IF EXISTS trg_log_main_profit ON public.orders;
CREATE TRIGGER trg_log_main_profit AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_main_profit();

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

DROP TRIGGER IF EXISTS trg_log_shop_profit ON public.shop_orders;
CREATE TRIGGER trg_log_shop_profit AFTER UPDATE ON public.shop_orders
FOR EACH ROW EXECUTE FUNCTION public.log_shop_profit();
