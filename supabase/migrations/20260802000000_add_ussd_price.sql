-- ============================================================================
-- USSD-only pricing for result checkers
-- ============================================================================
-- The USSD flow (*731*2641#) previously charged customer_price, the same price
-- the web storefront and dashboard show. ussd_price lets the USSD menu quote and
-- charge a different amount without touching any web-facing price.
--
-- NULL means "no USSD override" — the USSD flow falls back to customer_price.
-- ============================================================================

ALTER TABLE public.results_checker_types
  ADD COLUMN IF NOT EXISTS ussd_price DECIMAL(12,2) DEFAULT NULL;

COMMENT ON COLUMN public.results_checker_types.ussd_price IS
  'Price charged on the USSD short code only. NULL falls back to customer_price.';

-- Set every active checker to GHS 0.01 on USSD. Web pricing is unchanged.
UPDATE public.results_checker_types
   SET ussd_price = 0.01,
       updated_at = NOW()
 WHERE is_active = true;

-- Verify: this is exactly what the USSD menu will list.
SELECT display_order,
       name,
       customer_price,
       ussd_price,
       is_active
FROM public.results_checker_types
WHERE is_active = true
ORDER BY display_order ASC;
