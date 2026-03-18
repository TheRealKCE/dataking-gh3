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

-- 2. Drop the trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS on_order_status_change ON orders;

-- 3. Create the trigger on the 'orders' table
CREATE TRIGGER on_order_status_change
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION sync_shop_order_status_from_orders();

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

-- Output confirmation
DO $$ 
BEGIN 
  RAISE NOTICE 'Order status sync trigger installed and existing desynced records backfilled successfully.'; 
END $$;
