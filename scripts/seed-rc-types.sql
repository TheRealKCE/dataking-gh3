-- ============================================================================
-- Seed the live USSD Result Checker menu: BECE and WASSCE at GHS 18
-- ============================================================================
-- Produces the menu:
--   1. BECE (18 GHS)
--   2. WASSCE (18 GHS)
-- display_order controls the order shown in the USSD menu (ascending).
--
-- ADJUST BEFORE RUNNING: agent_price and cost_price are set equal to
-- customer_price (18) as safe placeholders — the rc_types_pricing_sanity
-- constraint requires customer_price >= cost_price AND agent_price >= cost_price.
-- Set cost_price to your true supplier cost and agent_price to the dealer price;
-- neither affects what the USSD menu displays (only customer_price is shown).
--
-- Run in the Supabase SQL editor (service role). Re-running is safe — it
-- upserts by the unique name, so prices are corrected in place.
-- ============================================================================

INSERT INTO public.results_checker_types
  (name, customer_price, agent_price, cost_price, is_active, display_order)
VALUES
  ('BECE',   18.00, 18.00, 18.00, true, 1),
  ('WASSCE', 18.00, 18.00, 18.00, true, 2)
ON CONFLICT (name) DO UPDATE
  SET customer_price = EXCLUDED.customer_price,
      agent_price    = EXCLUDED.agent_price,
      cost_price     = EXCLUDED.cost_price,
      is_active      = EXCLUDED.is_active,
      display_order  = EXCLUDED.display_order,
      updated_at     = NOW();

-- Verify: this is exactly what the USSD menu will list.
SELECT display_order,
       name,
       customer_price,
       is_active
FROM public.results_checker_types
WHERE is_active = true
ORDER BY display_order ASC;
