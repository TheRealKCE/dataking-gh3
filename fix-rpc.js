require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
let url = '';
let key = '';
envContent.split('\n').forEach(line => {
    if (line.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)$/)) url = RegExp..replace(/^"|"$|^'|'$/g, '');
    if (line.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)$/)) key = RegExp..replace(/^"|"$|^'|'$/g, '');
});

const supabase = createClient(url, key);

async function fix() {
  const sql = 
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
AS \\\$\\\$
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

  -- Step 1 & 2: Select, lock, and update available vouchers
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
  SELECT updated.id, updated.pin, updated.serial_number FROM updated;

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
\\\$\\\$;
  ;
  
  // Unfortunately, Supabase JS client doesn't have a direct raw SQL execution method
  // unless we expose an RPC that executes SQL, which we don't have.
  // Wait, I can just use postgres driver. Is 'pg' installed?
}

fix();
