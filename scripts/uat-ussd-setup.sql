-- ============================================================================
-- UAT: USSD Result Checker end-to-end test at GHS 0.01
-- ============================================================================
-- Hubtel UAT (test USSD code *713*2641#) requires testing with a tiny amount
-- (e.g. 0.01). The live USSD flow charges the checker's real customer_price,
-- so we add a dedicated 0.01 "UAT TEST" checker plus one dummy voucher. The
-- full live path — menu, 0.01 AddToCart charge, fulfilment, SMS — then works
-- unchanged. Pick this item (option 1) in the USSD menu.
--
-- Run in the Supabase SQL editor (service role). Reverse with uat-ussd-teardown.sql.
-- ============================================================================

-- 1. Create the 0.01 test checker type.
--    display_order = 0 so it appears first in the USSD menu.
--    cost_price must be <= customer_price (rc_types_pricing_sanity constraint).
INSERT INTO public.results_checker_types
  (name, customer_price, agent_price, cost_price, is_active, display_order)
VALUES
  ('UAT TEST', 0.01, 0.01, 0.01, true, 0)
ON CONFLICT (name) DO UPDATE
  SET customer_price = 0.01,
      agent_price    = 0.01,
      cost_price     = 0.01,
      is_active      = true,
      display_order  = 0,
      updated_at     = NOW();

-- 2. Seed one available dummy voucher for that type so fulfilment has stock.
--    Fake test PIN/Serial, delivered by SMS during UAT. Safe to re-run
--    (UNIQUE(type_id, pin) + ON CONFLICT DO NOTHING).
INSERT INTO public.results_checker_inventory
  (type_id, pin, serial_number, status, batch_id)
SELECT t.id, 'UAT-PIN-0001', 'UAT-SERIAL-0001', 'available', 'UAT-BATCH'
FROM public.results_checker_types t
WHERE t.name = 'UAT TEST'
ON CONFLICT (type_id, pin) DO NOTHING;

-- 3. Confirm what was created.
SELECT t.name, t.customer_price, t.is_active, t.display_order,
       count(i.id) FILTER (WHERE i.status = 'available') AS available_vouchers
FROM public.results_checker_types t
LEFT JOIN public.results_checker_inventory i ON i.type_id = t.id
WHERE t.name = 'UAT TEST'
GROUP BY t.id, t.name, t.customer_price, t.is_active, t.display_order;
