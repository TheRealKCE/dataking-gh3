-- ============================================================================
-- Import Result Checker voucher stock (PIN + Serial) for BECE / WASSCE
-- ============================================================================
-- A USSD sale calls assign_results_checker_vouchers, which hands out an
-- 'available' row from results_checker_inventory for the chosen type. Without
-- stock, the customer pays but fulfilment fails. Run this to load real vouchers.
--
-- HOW TO USE:
--   1. Replace the example (pin, serial) pairs below with your REAL vouchers.
--   2. Keep the correct block for each exam type (BECE vs WASSCE).
--   3. Run in the Supabase SQL editor (service role).
--
-- Safe to re-run: UNIQUE(type_id, pin) + ON CONFLICT DO NOTHING means the same
-- PIN is never imported twice. type_id is resolved by name, so no UUIDs needed.
-- Set a batch_id per upload so you can track/audit each import.
-- ============================================================================

-- ── BECE vouchers ───────────────────────────────────────────────────────────
INSERT INTO public.results_checker_inventory (type_id, pin, serial_number, status, batch_id)
SELECT t.id, v.pin, v.serial, 'available', 'BECE-2026-BATCH-01'
FROM public.results_checker_types t
CROSS JOIN (VALUES
    ('111111111111', 'WRC000000001'),   -- <-- replace with real PIN, Serial
    ('222222222222', 'WRC000000002'),
    ('333333333333', 'WRC000000003')
) AS v(pin, serial)
WHERE t.name = 'BECE'
ON CONFLICT (type_id, pin) DO NOTHING;

-- ── WASSCE vouchers ─────────────────────────────────────────────────────────
INSERT INTO public.results_checker_inventory (type_id, pin, serial_number, status, batch_id)
SELECT t.id, v.pin, v.serial, 'available', 'WASSCE-2026-BATCH-01'
FROM public.results_checker_types t
CROSS JOIN (VALUES
    ('444444444444', 'WRC000000004'),   -- <-- replace with real PIN, Serial
    ('555555555555', 'WRC000000005'),
    ('666666666666', 'WRC000000006')
) AS v(pin, serial)
WHERE t.name = 'WASSCE'
ON CONFLICT (type_id, pin) DO NOTHING;

-- ── Verify available stock per type ─────────────────────────────────────────
SELECT t.name,
       count(*) FILTER (WHERE i.status = 'available') AS available,
       count(*) FILTER (WHERE i.status = 'reserved')  AS reserved,
       count(*) FILTER (WHERE i.status = 'sold')      AS sold
FROM public.results_checker_types t
LEFT JOIN public.results_checker_inventory i ON i.type_id = t.id
WHERE t.name IN ('BECE', 'WASSCE')
GROUP BY t.name
ORDER BY t.name;
