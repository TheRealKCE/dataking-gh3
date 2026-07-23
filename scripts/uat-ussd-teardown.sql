-- ============================================================================
-- UAT teardown: remove the GHS 0.01 USSD test checker and its vouchers
-- ============================================================================
-- Run after UAT is signed off. Deletes the test type; inventory rows cascade
-- via results_checker_inventory.type_id ... ON DELETE CASCADE.
--
-- NOTE: if any real order already references a UAT voucher (a completed test
-- sale), the delete is still safe — orders store their own type_name/inventory
-- snapshot and do not FK-block the type delete. If you would rather keep the
-- history visible, deactivate instead of delete (see the commented option).
-- ============================================================================

-- Option A (default): hard delete the test type + its vouchers (cascades).
DELETE FROM public.results_checker_types
WHERE name = 'UAT TEST (0.01)';

-- Option B (alternative): keep the row but hide it from the USSD menu.
-- Comment out Option A above and use this instead:
-- UPDATE public.results_checker_types
--   SET is_active = false, display_order = 999, updated_at = NOW()
--   WHERE name = 'UAT TEST (0.01)';

-- Verify it's gone / inactive.
SELECT name, is_active FROM public.results_checker_types
WHERE name = 'UAT TEST (0.01)';
