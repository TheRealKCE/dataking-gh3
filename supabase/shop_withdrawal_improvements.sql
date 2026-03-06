-- ============================================================
-- Shop Withdrawal Improvements Migration
-- Adds: shop_payment_details table, network + balance_snapshot
--       columns to shop_wallet_transactions
-- ============================================================

-- 1. Add new columns to shop_wallet_transactions
ALTER TABLE public.shop_wallet_transactions
    ADD COLUMN IF NOT EXISTS network TEXT,
    ADD COLUMN IF NOT EXISTS balance_snapshot NUMERIC(12, 2);

-- 2. Create shop_payment_details table
CREATE TABLE IF NOT EXISTS public.shop_payment_details (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_name    TEXT NOT NULL,
    momo_number     TEXT NOT NULL,
    network         TEXT NOT NULL CHECK (network IN ('MTN MoMo', 'Telecel Cash', 'AirtelTigo Money')),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS on shop_payment_details
ALTER TABLE public.shop_payment_details ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Owners manage their own details
DROP POLICY IF EXISTS "Owners can view their own payment details" ON public.shop_payment_details;
CREATE POLICY "Owners can view their own payment details"
    ON public.shop_payment_details FOR SELECT
    USING (auth.uid() = shop_owner_id);

DROP POLICY IF EXISTS "Owners can insert their own payment details" ON public.shop_payment_details;
CREATE POLICY "Owners can insert their own payment details"
    ON public.shop_payment_details FOR INSERT
    WITH CHECK (auth.uid() = shop_owner_id);

DROP POLICY IF EXISTS "Owners can update their own payment details" ON public.shop_payment_details;
CREATE POLICY "Owners can update their own payment details"
    ON public.shop_payment_details FOR UPDATE
    USING (auth.uid() = shop_owner_id)
    WITH CHECK (auth.uid() = shop_owner_id);

DROP POLICY IF EXISTS "Owners can delete their own payment details" ON public.shop_payment_details;
CREATE POLICY "Owners can delete their own payment details"
    ON public.shop_payment_details FOR DELETE
    USING (auth.uid() = shop_owner_id);

-- 5. Admins can view all payment details
DROP POLICY IF EXISTS "Admins can view all payment details" ON public.shop_payment_details;
CREATE POLICY "Admins can view all payment details"
    ON public.shop_payment_details FOR SELECT
    USING (public.is_admin());

-- 6. Trigger: enforce max 5 saved details per owner
CREATE OR REPLACE FUNCTION public.enforce_max_payment_details()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.shop_payment_details WHERE shop_owner_id = NEW.shop_owner_id) >= 5 THEN
        RAISE EXCEPTION 'You can only save a maximum of 5 payment details.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_max_payment_details ON public.shop_payment_details;
CREATE TRIGGER trg_max_payment_details
    BEFORE INSERT ON public.shop_payment_details
    FOR EACH ROW EXECUTE FUNCTION public.enforce_max_payment_details();

-- 7. Trigger: ensure only one default per owner
--    When a row is set as default, clear others for that owner.
CREATE OR REPLACE FUNCTION public.enforce_single_default_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE public.shop_payment_details
        SET is_default = FALSE
        WHERE shop_owner_id = NEW.shop_owner_id
          AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_default_payment ON public.shop_payment_details;
CREATE TRIGGER trg_single_default_payment
    AFTER INSERT OR UPDATE ON public.shop_payment_details
    FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_payment();
