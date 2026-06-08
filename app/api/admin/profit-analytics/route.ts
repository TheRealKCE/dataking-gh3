import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin or sub-admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        
        // Determine date range. Default to today if not provided.
        const startDateParam = searchParams.get('startDate')
        const endDateParam = searchParams.get('endDate')
        
        const now = new Date()
        const startDate = startDateParam ? new Date(startDateParam) : new Date(now.setUTCHours(0,0,0,0))
        const endDate = endDateParam ? new Date(endDateParam) : new Date(now.setUTCHours(23,59,59,999))
        
        // Calculate previous period for growth comparison
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const prevEndDate = new Date(startDate.getTime() - 1);
        const prevStartDate = new Date(prevEndDate.getTime() - diffTime);

        // Service role client to execute RPCs
        const supabase = createServerClient()
        const db = supabase as any

        // Execute all 4 RPCs in parallel for maximum performance
        const [
            { data: summaryData, error: summaryError },
            { data: timeseriesData, error: timeseriesError },
            { data: shopOwnersData, error: shopOwnersError },
            { data: walletData, error: walletError }
        ] = await Promise.all([
            db.rpc('get_profit_summary', { 
                p_start_date: startDate.toISOString(), 
                p_end_date: endDate.toISOString(),
                p_prev_start_date: prevStartDate.toISOString(),
                p_prev_end_date: prevEndDate.toISOString()
            }),
            db.rpc('get_profit_timeseries', { 
                p_start_date: startDate.toISOString(), 
                p_end_date: endDate.toISOString() 
            }),
            db.rpc('get_shop_owner_stats'),
            db.rpc('get_wallet_overview')
        ])

        if (summaryError) console.error('[ProfitAnalytics] Summary Error:', summaryError)
        if (timeseriesError) console.error('[ProfitAnalytics] Timeseries Error:', timeseriesError)
        if (shopOwnersError) console.error('[ProfitAnalytics] Shop Owners Error:', shopOwnersError)
        if (walletError) console.error('[ProfitAnalytics] Wallet Error:', walletError)

        if (summaryError || timeseriesError || shopOwnersError || walletError) {
             throw new Error('Failed to compute analytics from database')
        }

        return NextResponse.json({
            ...summaryData,
            charts_data: {
                daily: timeseriesData || []
            },
            shop_owner_stats: shopOwnersData || [],
            wallet_stats: walletData || {
                total_user_balance: 0,
                user_count: 0,
                total_shop_owner_balance: 0,
                shop_owner_count: 0
            }
        })

    } catch (error: any) {
        console.error('Profit Analytics App API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
