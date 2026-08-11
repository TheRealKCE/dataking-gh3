-- ============================================================
-- Per-Shop USSD Short Codes
--
-- A shop buys a one-time, lifetime "short code": a 4-character
-- identifier a customer types after dialling the ARHMS USSD code
-- (*713*9863#) to shop that shop's catalogue at that shop's prices.
--
-- The code only exists after payment — there is deliberately no
-- trigger assigning one on approval.
-- ============================================================

ALTER TABLE public.shop_profiles
  ADD COLUMN IF NOT EXISTS ussd_code                 TEXT,
  ADD COLUMN IF NOT EXISTS ussd_status               TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS ussd_activated_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ussd_activation_reference TEXT,
  ADD COLUMN IF NOT EXISTS ussd_activation_amount    DECIMAL(12,2);

DO $$
BEGIN
    ALTER TABLE public.shop_profiles
      ADD CONSTRAINT shop_ussd_status_chk
      CHECK (ussd_status IN ('inactive', 'active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The alphabet excludes 0/O, 1/I and 5/S: these are read aloud and copied off
-- flyers, so ambiguous glyphs cost real support tickets.
DO $$
BEGIN
    ALTER TABLE public.shop_profiles
      ADD CONSTRAINT shop_ussd_code_fmt
      CHECK (ussd_code IS NULL OR ussd_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_profiles_ussd_code
  ON public.shop_profiles (ussd_code) WHERE ussd_code IS NOT NULL;

-- Lookup index for the USSD hot path: every session resolves a code through this.
CREATE INDEX IF NOT EXISTS idx_shop_profiles_ussd_active
  ON public.shop_profiles (ussd_code)
  WHERE ussd_status = 'active' AND approval_status = 'approved' AND is_active = true;


-- ============================================================
-- assign_shop_ussd_code(shop_id) -> the shop's short code
--
-- Idempotent: returns the existing code if the shop already has one, so a
-- replayed payment webhook can never mint a second code for the same shop.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_shop_ussd_code(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    -- ALIAS FOR positional args, matching deduct_shop_wallet_balance: avoids
    -- parameter resolution issues under SECURITY DEFINER + empty search_path.
    _shop_id ALIAS FOR $1;
    v_alphabet  CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_existing  TEXT;
    v_house     TEXT;
    v_candidate TEXT;
    v_attempt   INT := 0;
BEGIN
    SELECT ussd_code INTO v_existing
    FROM public.shop_profiles WHERE id = _shop_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHOP_NOT_FOUND';
    END IF;

    IF v_existing IS NOT NULL THEN
        RETURN v_existing;
    END IF;

    -- `value` is JSONB. Casting it straight to TEXT would keep the JSON quotes
    -- ('"ARHM"'), which could never equal a generated candidate — and the house
    -- code would silently become assignable to a shop. #>> '{}' unwraps the scalar.
    SELECT value #>> '{}' INTO v_house
    FROM public.admin_settings WHERE key = 'ussd_house_code';
    v_house := upper(v_house);

    WHILE v_attempt < 10 LOOP
        v_attempt := v_attempt + 1;

        SELECT string_agg(substr(v_alphabet, (floor(random() * length(v_alphabet)) + 1)::int, 1), '')
        INTO v_candidate
        FROM generate_series(1, 4);

        -- The house code routes to platform-direct sales; it can never belong to a shop.
        CONTINUE WHEN v_house IS NOT NULL AND v_candidate = v_house;

        BEGIN
            UPDATE public.shop_profiles
            SET ussd_code = v_candidate, updated_at = NOW()
            WHERE id = _shop_id AND ussd_code IS NULL;

            IF FOUND THEN
                RETURN v_candidate;
            END IF;

            -- Lost a race: another transaction assigned a code first. Return theirs.
            SELECT ussd_code INTO v_existing
            FROM public.shop_profiles WHERE id = _shop_id;
            RETURN v_existing;
        EXCEPTION WHEN unique_violation THEN
            -- Collision on idx_shop_profiles_ussd_code; try another candidate.
            NULL;
        END;
    END LOOP;

    RAISE EXCEPTION 'USSD_CODE_GENERATION_FAILED';
END;
$$;

REVOKE ALL ON FUNCTION assign_shop_ussd_code(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION assign_shop_ussd_code(UUID) TO service_role;


-- ============================================================
-- Results Checker profit needs an idempotency key
--
-- RC sales produce no shop_orders row, so credit_shop_profit() (keyed on
-- shop_order_id) cannot cover them. creditShopRcProfit() keys on this instead,
-- so a replayed webhook credits the wallet exactly once.
-- ============================================================

ALTER TABLE public.shop_wallet_transactions
  ADD COLUMN IF NOT EXISTS reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_wallet_tx_reference
  ON public.shop_wallet_transactions (reference, type) WHERE reference IS NOT NULL;


-- ============================================================
-- Settings
-- ============================================================

-- admin_settings.value is JSONB, so every value here is a quoted JSON *string*.
-- That matches what the admin UI writes back (POST /api/admin-settings coerces
-- with String(value)) and what the readers expect: the app compares settings
-- with `=== 'true'` and calls .toUpperCase() on the house code, both of which
-- break if the value comes back as a JSON boolean or number instead.
INSERT INTO public.admin_settings (key, value) VALUES
  ('ussd_house_code',                '"ARHM"'),
  ('ussd_dial_code',                 '"*713*9863#"'),
  ('ussd_activation_price_customer', '"50"'),
  ('ussd_activation_price_agent',    '"40"'),
  ('ussd_activation_price_dealer',   '"30"'),
  ('storefront_ussd_card_enabled',   '"true"')
ON CONFLICT (key) DO NOTHING;
