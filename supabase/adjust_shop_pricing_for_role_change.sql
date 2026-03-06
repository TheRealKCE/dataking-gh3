-- ============================================================
-- RPC: adjust_shop_pricing_for_role_change
--
-- Called whenever a user's role changes (e.g. agent → customer).
-- For each package that the shop owner has priced, this function:
--   1. Calculates the original profit margin:
--          profit = current_selling_price − old_role_cost_price
--   2. Derives the new selling price:
--          new_selling_price = new_role_cost_price + profit
-- The shop is never deactivated; only the selling price is updated
-- so that the owner's absolute profit per package is preserved.
--
-- Parameters
--   p_user_id  UUID   — the user whose role just changed
--   p_old_role TEXT   — the role BEFORE the change (e.g. 'agent')
--   p_new_role TEXT   — the role AFTER  the change (e.g. 'customer')
--
-- Cost-price logic (mirroring the frontend getCostPrice() function)
--   agent    → data_packages.agent_price (if > 0, otherwise falls back to .price)
--   anything → data_packages.price
-- ============================================================

CREATE OR REPLACE FUNCTION adjust_shop_pricing_for_role_change(
    p_user_id  UUID,
    p_old_role TEXT,
    p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER   -- runs with elevated privileges so it can bypass RLS
AS $$
DECLARE
    v_shop_id        UUID;
    v_updated_count  INTEGER := 0;
    rec              RECORD;
    v_old_cost       DECIMAL(12,2);
    v_new_cost       DECIMAL(12,2);
    v_profit         DECIMAL(12,2);
    v_new_price      DECIMAL(12,2);
BEGIN
    -- 1. Find the user's shop (must be approved)
    SELECT id INTO v_shop_id
    FROM public.shop_profiles
    WHERE owner_id = p_user_id
    LIMIT 1;

    IF v_shop_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'updated', 0, 'message', 'No shop found for this user — nothing to adjust');
    END IF;

    -- 2. Loop over every pricing row for this shop
    FOR rec IN
        SELECT
            sp.id          AS pricing_id,
            sp.selling_price,
            dp.price       AS customer_price,
            dp.agent_price AS agent_price
        FROM public.shop_pricing sp
        JOIN public.data_packages dp ON dp.id = sp.package_id
        WHERE sp.shop_id = v_shop_id
    LOOP
        -- Determine old cost price based on old role
        IF p_old_role = 'agent' AND rec.agent_price > 0 THEN
            v_old_cost := rec.agent_price;
        ELSE
            v_old_cost := rec.customer_price;
        END IF;

        -- Determine new cost price based on new role
        IF p_new_role = 'agent' AND rec.agent_price > 0 THEN
            v_new_cost := rec.agent_price;
        ELSE
            v_new_cost := rec.customer_price;
        END IF;

        -- Skip if both costs are identical (no adjustment needed)
        IF v_old_cost = v_new_cost THEN
            CONTINUE;
        END IF;

        -- Preserve the existing absolute profit margin
        v_profit    := rec.selling_price - v_old_cost;
        v_new_price := v_new_cost + v_profit;

        -- Ensure the new selling price is always at least 1 pesewa above cost
        -- (guards against edge cases where profit was 0 or negative)
        IF v_new_price <= v_new_cost THEN
            v_new_price := v_new_cost + 0.01;
        END IF;

        -- Round to 2 decimal places
        v_new_price := ROUND(v_new_price, 2);

        -- Update the live pricing row
        UPDATE public.shop_pricing
        SET selling_price = v_new_price
        WHERE id = rec.pricing_id;

        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated', v_updated_count,
        'message', format('Adjusted %s pricing rows from %s to %s cost tier', v_updated_count, p_old_role, p_new_role)
    );
END;
$$;

-- Grant execution rights to the service role (used by the Next.js API)
GRANT EXECUTE ON FUNCTION adjust_shop_pricing_for_role_change(UUID, TEXT, TEXT) TO service_role;
