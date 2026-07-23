-- Migration: Add BECE and WASSCE as USSD Result Checker products
-- Date: 2026-07-23
-- Purpose: Populate initial result checker types for USSD flow testing with Hubtel

INSERT INTO public.results_checker_types
  (name, customer_price, agent_price, dealer_price, cost_price, is_active, display_order)
VALUES
  ('BECE',   0.01, 0.01, 0, 0.01, true, 1),
  ('WASSCE', 0.01, 0.01, 0, 0.01, true, 2)
ON CONFLICT (name) DO UPDATE SET
  customer_price = EXCLUDED.customer_price,
  agent_price    = EXCLUDED.agent_price,
  dealer_price   = EXCLUDED.dealer_price,
  cost_price     = EXCLUDED.cost_price,
  is_active      = true,
  display_order  = EXCLUDED.display_order,
  updated_at     = NOW();
