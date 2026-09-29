-- ============================================================
-- Shop-branded order confirmation SMS
--
-- A shop owner switches order confirmations on, and from then on their
-- storefront data and airtime buyers get the message from the SHOP's approved
-- sender ID, charged to the SHOP's SMS credits — instead of the ARHMS house
-- sender at the platform's expense.
--
-- Both toggles default to FALSE. This spends the owner's own money, so it has
-- to be opt-in; and because a shop with them off now sends nothing at all, off
-- is also the state that changes nothing for anyone who never visits the page.
-- ============================================================

ALTER TABLE public.sms_accounts
  ADD COLUMN IF NOT EXISTS order_sms_data_enabled    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_sms_airtime_enabled BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- sms_campaigns.source — allow 'order'
--
-- Order-triggered sends are real campaigns (one recipient each) so they inherit
-- the credit ledger, the delivery reports and the refund path for free. They
-- need their own source so History can tell them from something the owner typed.
-- ============================================================

DO $$ BEGIN
    ALTER TABLE public.sms_campaigns DROP CONSTRAINT IF EXISTS sms_campaigns_source_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.sms_campaigns
  ADD CONSTRAINT sms_campaigns_source_check
  CHECK (source IN ('dashboard', 'api', 'order'));


-- ============================================================
-- Storefront gateway
--
-- Split from active_sms_provider, which until now routed the platform's own
-- notifications AND every shop's customer SMS through one setting. They want
-- different things: the platform is happy on Moolre under one house sender,
-- while a shop sending under its OWN sender ID can only work on KingFlexy —
-- Moolre and Hubtel reject any sender not registered on the platform account
-- ("ASMS07: Sender ID is not approved").
--
-- Seeded to kingflexy because that is what the code already forces today, so
-- the split changes no behaviour on deploy.
-- ============================================================

INSERT INTO public.admin_settings (key, value) VALUES
  ('active_sms_provider_storefront', '"kingflexy"')
ON CONFLICT (key) DO NOTHING;
