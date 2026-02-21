-- Optimization: RPC functions to calculate dashboard stats in the database
-- This prevents fetching thousands of rows and processing them in JavaScript (Vercel server-side CPU)

-- 1. Admin Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalUsers', (SELECT count(*) FROM public.users),
        'totalOrders', (SELECT count(*) FROM public.orders),
        'completedOrders', (SELECT count(*) FROM public.orders WHERE status = 'completed'),
        'pendingOrders', (SELECT count(*) FROM public.orders WHERE status IN ('pending', 'processing')),
        'totalRevenue', COALESCE((SELECT sum(price) FROM public.orders WHERE status = 'completed'), 0),
        'totalWalletBalance', COALESCE((SELECT sum(balance) FROM public.wallets), 0),
        'successRate', CASE 
            WHEN (SELECT count(*) FROM public.orders) > 0 
            THEN round(((SELECT count(*) FROM public.orders WHERE status = 'completed')::float / (SELECT count(*) FROM public.orders)::float) * 100)
            ELSE 0 
        END,
        'todayOrders', (SELECT count(*) FROM public.orders WHERE created_at >= CURRENT_DATE)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. User Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND shop_order_id IS NULL),
        'completedOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'completed' AND shop_order_id IS NULL),
        'processingOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'processing' AND shop_order_id IS NULL),
        'failedOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'failed' AND shop_order_id IS NULL),
        'pendingOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'pending' AND shop_order_id IS NULL),
        'walletBalance', COALESCE((SELECT balance FROM public.wallets WHERE user_id = p_user_id), 0)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_dashboard_stats(UUID) TO authenticated;
