-- PaySwitch (TheTeller) gateway support
--
-- wallet_payments.provider has no CHECK constraint, so 'payswitch' needs no column
-- change. What it does need is a reliable home for TheTeller's transaction_id:
-- that field is 12 NUMERIC digits and cannot hold our prefix-routed references
-- (WAL-/DATA-/SHOP-/BOOST-/RC-/agent_upgrade_), so the numeric id lives in the
-- previously-unused provider_reference column and the webhook maps back from it.

-- The webhook's only lookup path: transaction_id -> internal reference.
CREATE INDEX IF NOT EXISTS idx_wallet_payments_provider_reference
    ON wallet_payments (provider_reference)
    WHERE provider_reference IS NOT NULL;

-- A reused transaction_id would let one callback settle the wrong payment.
-- Partial, because the column is NULL for every Moolre/Hubtel/Paystack row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_payments_provider_reference
    ON wallet_payments (provider_reference)
    WHERE provider_reference IS NOT NULL;

-- Reconciliation cron sweeps pending rows for one provider at a time.
CREATE INDEX IF NOT EXISTS idx_wallet_payments_provider_status_created
    ON wallet_payments (provider, status, created_at);

-- Ensure all three scope toggles exist. Existing values are left untouched —
-- PaySwitch goes live by flipping a setting, not by deploying this file.
INSERT INTO admin_settings (key, value)
VALUES
  ('active_payment_provider_web',         'moolre'),
  ('active_payment_provider_shop',        'moolre'),
  ('active_payment_provider_classifieds', 'moolre')
ON CONFLICT (key) DO NOTHING;
