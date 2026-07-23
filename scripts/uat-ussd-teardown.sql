-- ============================================================================
-- UAT teardown: remove the GHS 0.01 USSD test checker and its vouchers
-- ============================================================================
-- Run after UAT is signed off. Deleting the type cascades to its inventory
-- (results_checker_inventory.type_id ... ON DELETE CASCADE). Orders keep their
-- own type_name/inventory snapshot, so this does not affect sale history.
-- ============================================================================

-- Option A (default): hard delete the test type + its vouchers (cascades).
DELETE FROM public.results_checker_types
WHERE name = 'UAT TEST';

-- Option B (alternative): keep the row but hide it from the USSD menu.
-- Comment out Option A above and use this instead:
-- UPDATE public.results_checker_types
--   SET is_active = false, display_order = 999, updated_at = NOW()
--   WHERE name = 'UAT TEST';

-- Verify it's gone / inactive.
SELECT name, is_active FROM public.results_checker_types
WHERE name = 'UAT TEST';
