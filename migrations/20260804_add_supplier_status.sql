-- Supplier sub-state for orders that are still in flight.
--
-- Suppliers distinguish states our own `status` column cannot hold: NetPulse
-- parks orders under manual review as "Verifying" / "On Hold" before they reach
-- Delivered. Both collapse to status='processing' here, so an order stuck in
-- review looked identical to one that had just been submitted.
--
-- Deliberately a free-text column with NO check constraint, and deliberately
-- NOT part of `status`: the status CHECK is depended on by ~113 branches across
-- the app (list filters, stats counts, the sync/refulfill crons). Adding a value
-- there would make any un-audited `.eq('status','processing')` filter silently
-- drop these orders. This column is additive and inert — nothing reads it unless
-- it opts in.
--
-- Holds the supplier's RAW label, lowercased. Cleared when the order goes
-- terminal, so a stale "verifying" can never outlive the order it described.

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS supplier_status TEXT;

ALTER TABLE public.shop_orders
    ADD COLUMN IF NOT EXISTS supplier_status TEXT;

COMMENT ON COLUMN public.orders.supplier_status IS
    'Raw in-flight status reported by the fulfilling supplier (e.g. "verifying"). Display only — never branch on this for business logic. NULL once the order is terminal.';

COMMENT ON COLUMN public.shop_orders.supplier_status IS
    'Raw in-flight status reported by the fulfilling supplier (e.g. "verifying"). Display only — never branch on this for business logic. NULL once the order is terminal.';
