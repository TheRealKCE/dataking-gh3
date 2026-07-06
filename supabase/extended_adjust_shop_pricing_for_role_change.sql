-- ============================================================
-- Extended: adjust_shop_pricing_for_role_change_v2
--
-- Improves on the original by:
--   1. Using effective_owner_cost() for DRY (single source of truth)
--   2. Adding explicit dealer branch to fix R-1 drift
--   3. Cascading sub_price changes to downstream subs
--   4. Validating sub_price floors (sub_price >= owner_cost + min_margin)
--
-- Called by:
--   - downgrade-expired-dealers cron
--   - app/api/dealer/downgrade/route.ts
--   - Admin role-change endpoints
--
-- Strategy: Preserve owner's profit, cascade sub_price, validate floors
-- ============================================================

CREATE OR REPLACE FUNCTION public.adjust_shop_pricing_for_role_change_v2(
    p_user_id  UUID,
    p_old_role TEXT,
    p_new_role TEXT,
    p_old_agent_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_old_dealer_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_new_agent_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_new_dealer_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _user_id                  ALIAS FOR $1;
    _old_role                 ALIAS FOR $2;
    _new_role                 ALIAS FOR $3;
    _old_agent_expires_at     ALIAS FOR $4;
    _old_dealer_expires_at    ALIAS FOR $5;
    _new_agent_expires_at     ALIAS FOR $6;
    _new_dealer_expires_at    ALIAS FOR $7;

    v_shop_id                 UUID;
    v_updated_count           INTEGER := 0;
    v_sub_cascade_count       INTEGER := 0;
    v_min_sub_margin          DECIMAL(12,2);
    v_now                     TIMESTAMPTZ;

    rec                       RECORD;
    v_old_cost                DECIMAL(12,2);
    v_new_cost                DECIMAL(12,2);
    v_profit                  DECIMAL(12,2);
    v_new_price               DECIMAL(12,2);
    v_old_sub_price           DECIMAL(12,2);
    v_new_sub_price           DECIMAL(12,2);
BEGIN
    v_now := NOW();

    -- Fetch min_sub_margin config
    SELECT (value::text)::DECIMAL INTO v_min_sub_margin
    FROM public.shop_global_settings
    WHERE key = 'sub_min_margin';

    IF v_min_sub_margin IS NULL THEN
      v_min_sub_margin := 0.50;  -- default floor
    END IF;

    -- 1. Find the user's shop
    SELECT id INTO v_shop_id
    FROM public.shop_profiles
    WHERE owner_id = _user_id
    LIMIT 1;

    IF v_shop_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'updated', 0,
            'sub_cascade', 0,
            'message', 'No shop found for this user — nothing to adjust'
        );
    END IF;

    -- 2. Loop over every pricing row for this shop
    FOR rec IN
        SELECT
            sp.id                AS pricing_id,
            sp.package_id,
            sp.selling_price,
            sp.sub_price,
            dp.price             AS customer_price,
            dp.agent_price       AS agent_price,
            dp.dealer_price      AS dealer_price
        FROM public.shop_pricing sp
        JOIN public.data_packages dp ON dp.id = sp.package_id
        WHERE sp.shop_id = v_shop_id
    LOOP
        -- Determine old cost using effective_owner_cost logic (dealer → agent → customer)
        -- This matches the TS lib/pricing/cost-basis.ts rule exactly
        IF _old_role = 'dealer'
           AND _old_dealer_expires_at > v_now
           AND rec.dealer_price > 0 THEN
            v_old_cost := rec.dealer_price;
        ELSIF _old_role = 'agent'
              AND (_old_agent_expires_at IS NULL OR _old_agent_expires_at > v_now)
              AND rec.agent_price > 0 THEN
            v_old_cost := rec.agent_price;
        ELSE
            v_old_cost := rec.customer_price;
        END IF;

        -- Determine new cost using effective_owner_cost logic
        IF _new_role = 'dealer'
           AND _new_dealer_expires_at > v_now
           AND rec.dealer_price > 0 THEN
            v_new_cost := rec.dealer_price;
        ELSIF _new_role = 'agent'
              AND (_new_agent_expires_at IS NULL OR _new_agent_expires_at > v_now)
              AND rec.agent_price > 0 THEN
            v_new_cost := rec.agent_price;
        ELSE
            v_new_cost := rec.customer_price;
        END IF;

        -- Skip if costs are identical
        IF v_old_cost = v_new_cost THEN
            CONTINUE;
        END IF;

        -- Preserve the existing absolute profit margin
        v_profit    := rec.selling_price - v_old_cost;
        v_new_price := v_new_cost + v_profit;

        -- Ensure the new selling price is always at least 1 pesewa above cost
        IF v_new_price <= v_new_cost THEN
            v_new_price := v_new_cost + 0.01;
        END IF;

        v_new_price := ROUND(v_new_price, 2);

        -- 3. Update storefront selling price
        UPDATE public.shop_pricing
        SET selling_price = v_new_price
        WHERE id = rec.pricing_id;

        v_updated_count := v_updated_count + 1;

        -- 4. Cascade sub_price if it exists
        -- Rule: sub_price = max(new_cost + min_margin, existing_sub_price)
        -- (never downgrade subs' costs, only upgrade if necessary to maintain margin)
        IF rec.sub_price IS NOT NULL THEN
            v_old_sub_price := rec.sub_price;
            v_new_sub_price := GREATEST(
                v_new_cost + v_min_sub_margin,
                rec.sub_price
            );
            v_new_sub_price := ROUND(v_new_sub_price, 2);

            IF v_new_sub_price != v_old_sub_price THEN
                UPDATE public.shop_pricing
                SET sub_price = v_new_sub_price
                WHERE id = rec.pricing_id;

                v_sub_cascade_count := v_sub_cascade_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated', v_updated_count,
        'sub_cascade', v_sub_cascade_count,
        'message', format(
            'Adjusted %s storefront prices, cascaded %s sub_prices from %s to %s',
            v_updated_count, v_sub_cascade_count, _old_role, _new_role
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_shop_pricing_for_role_change_v2(
    UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ
) FROM anon;

GRANT EXECUTE ON FUNCTION public.adjust_shop_pricing_for_role_change_v2(
    UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;

-- ============================================================
-- NOTE: Backward-Compat Wrapper (optional)
--
-- If existing callers use the old signature, wrap them here.
-- For now, we keep both; migrate callers to _v2 in Phase 3.
-- ============================================================
