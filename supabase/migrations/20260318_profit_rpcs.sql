-- ============================================================================
-- get_profit_summary
-- Calculates revenue, cost, profit, growth for defined period
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_profit_summary(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_prev_start_date TIMESTAMP WITH TIME ZONE,
    p_prev_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Current Period
    v_main_revenue DECIMAL := 0;
    v_main_cost DECIMAL := 0;
    v_main_orders INT := 0;
    v_main_excluded INT := 0;

    v_shop_revenue DECIMAL := 0;
    v_shop_platform_cost DECIMAL := 0;
    v_shop_owner_profit_sum DECIMAL := 0;
    v_shop_orders INT := 0;
    v_shop_excluded INT := 0;

    -- Previous Period (for Growth)
    v_prev_main_profit DECIMAL := 0;
    v_prev_shop_platform_profit DECIMAL := 0;

    -- Totals
    v_total_revenue DECIMAL;
    v_total_cost DECIMAL;
    v_total_profit DECIMAL;
    v_profit_margin DECIMAL := 0;
    v_growth_pct DECIMAL := 0;
BEGIN
    -- MAIN: Current Period (Only Completed, Valid Cost)
    SELECT 
        COALESCE(SUM(price), 0),
        COALESCE(SUM(cost_price_at_time), 0),
        COUNT(id)
    INTO v_main_revenue, v_main_cost, v_main_orders
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- MAIN: Excluded Orders
    SELECT COUNT(id) INTO v_main_excluded
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND (cost_price_at_time IS NULL OR cost_price_at_time <= 0)
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- SHOP: Current Period
    SELECT 
        COALESCE(SUM(cost_price), 0),          -- What platform earned
        COALESCE(SUM(admin_cost_at_time), 0),  -- Platform's true cost
        COALESCE(SUM(profit), 0),              -- Owner's cut
        COUNT(id)
    INTO v_shop_revenue, v_shop_platform_cost, v_shop_owner_profit_sum, v_shop_orders
    FROM public.shop_orders
    WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- SHOP: Excluded Orders
    SELECT COUNT(id) INTO v_shop_excluded
    FROM public.shop_orders
    WHERE status = 'completed' AND (admin_cost_at_time IS NULL OR admin_cost_at_time <= 0)
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- PREVIOUS PERIOD (For Growth calculation)
    SELECT COALESCE(SUM(price - cost_price_at_time), 0) INTO v_prev_main_profit
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
    AND created_at BETWEEN p_prev_start_date AND p_prev_end_date;

    SELECT COALESCE(SUM(cost_price - admin_cost_at_time), 0) INTO v_prev_shop_platform_profit
    FROM public.shop_orders
    WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    AND created_at BETWEEN p_prev_start_date AND p_prev_end_date;

    -- Compute Totals
    v_total_revenue := v_main_revenue + v_shop_revenue;
    v_total_cost := v_main_cost + v_shop_platform_cost;
    v_total_profit := (v_main_revenue - v_main_cost) + (v_shop_revenue - v_shop_platform_cost);
    
    IF v_total_revenue > 0 THEN
        v_profit_margin := ROUND((v_total_profit / v_total_revenue) * 100, 2);
    END IF;

    -- Compute Growth
    DECLARE
        v_prev_total_profit DECIMAL := v_prev_main_profit + v_prev_shop_platform_profit;
    BEGIN
        IF v_prev_total_profit > 0 THEN
            v_growth_pct := ROUND(((v_total_profit - v_prev_total_profit) / v_prev_total_profit) * 100, 2);
        ELSIF v_total_profit > 0 THEN
            v_growth_pct := 100;
        END IF;
    END;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'total_revenue', v_total_revenue,
            'total_cost', v_total_cost,
            'total_profit', v_total_profit,
            'profit_margin', v_profit_margin,
            'total_orders', v_main_orders + v_shop_orders,
            'excluded_orders', v_main_excluded + v_shop_excluded,
            'growth_percent', v_growth_pct
        ),
        'main_stats', jsonb_build_object(
            'revenue', v_main_revenue,
            'cost', v_main_cost,
            'profit', v_main_revenue - v_main_cost,
            'orders', v_main_orders
        ),
        'shop_stats', jsonb_build_object(
            'revenue', v_shop_revenue,
            'platform_cost', v_shop_platform_cost,
            'platform_profit', v_shop_revenue - v_shop_platform_cost,
            'owner_profit', v_shop_owner_profit_sum,
            'orders', v_shop_orders
        )
    );
END;
$$;

-- ============================================================================
-- get_profit_timeseries
-- Pre-aggregates daily results to feed charts without huge payloads
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_profit_timeseries(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH dates AS (
        SELECT generate_series(
            p_start_date::date,
            p_end_date::date,
            '1 day'::interval
        )::date AS day
    ),
    main_daily AS (
        SELECT 
            DATE(created_at) as day,
            SUM(price) as main_rev,
            SUM(price - cost_price_at_time) as main_profit
        FROM public.orders
        WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
    ),
    shop_daily AS (
        SELECT 
            DATE(created_at) as day,
            SUM(cost_price) as shop_rev,
            SUM(cost_price - admin_cost_at_time) as shop_platform_profit,
            SUM(profit) as shop_owner_profit
        FROM public.shop_orders
        WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', TO_CHAR(d.day, 'YYYY-MM-DD'),
            'main_revenue', COALESCE(m.main_rev, 0),
            'main_profit', COALESCE(m.main_profit, 0),
            'shop_revenue', COALESCE(s.shop_rev, 0),
            'shop_platform_profit', COALESCE(s.shop_platform_profit, 0),
            'shop_owner_profit', COALESCE(s.shop_owner_profit, 0)
        ) ORDER BY d.day ASC
    ), '[]'::jsonb) INTO v_result
    FROM dates d
    LEFT JOIN main_daily m ON m.day = d.day
    LEFT JOIN shop_daily s ON s.day = d.day;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- get_shop_owner_stats
-- Analytical view of top shop owners
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_shop_owner_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'owner_id', u.id,
            'owner_name', COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
            'shop_name', sp.shop_name,
            'total_sales_count', COALESCE(stats.sales_count, 0),
            'total_sales_value', COALESCE(stats.sales_value, 0),
            'platform_profit', COALESCE(stats.plat_profit, 0),
            'owner_profit', COALESCE(stats.own_profit, 0),
            'wallet_balance', COALESCE(sw.balance, 0)
        ) ORDER BY stats.own_profit DESC NULLS LAST
    ), '[]'::jsonb) INTO v_result
    FROM public.shop_profiles sp
    JOIN public.users u ON u.id = sp.owner_id
    LEFT JOIN public.shop_wallets sw ON sw.owner_id = sp.owner_id
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(id) as sales_count,
            SUM(selling_price) as sales_value,
            SUM(cost_price - admin_cost_at_time) as plat_profit,
            SUM(profit) as own_profit
        FROM public.shop_orders
        WHERE shop_id = sp.id AND status = 'completed' 
          AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    ) stats ON true;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- get_wallet_overview
-- Aggregate overall wallet metrics vs derived profit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_wallet_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_bal DECIMAL := 0;
    v_user_count INT := 0;
    v_shop_bal DECIMAL := 0;
    v_shop_count INT := 0;
BEGIN
    -- Regular User Wallets (Exclude Admins if preferred, or include all valid users)
    SELECT COALESCE(SUM(w.balance), 0), COUNT(w.id) 
    INTO v_user_bal, v_user_count
    FROM public.wallets w
    JOIN public.users u ON u.id = w.user_id
    WHERE u.role NOT IN ('admin', 'sub-admin') AND w.balance > 0;

    -- Shop Owner Wallets
    SELECT COALESCE(SUM(balance), 0), COUNT(id) 
    INTO v_shop_bal, v_shop_count
    FROM public.shop_wallets
    WHERE balance > 0;

    RETURN jsonb_build_object(
        'total_user_balance', v_user_bal,
        'user_count', v_user_count,
        'total_shop_owner_balance', v_shop_bal,
        'shop_owner_count', v_shop_count
    );
END;
$$;
