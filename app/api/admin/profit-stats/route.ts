import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminAccess } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const { searchParams } = new URL(request.url)
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Fetch ALL orders except failed from ALL users
        let orderQuery = supabase
            .from('orders')
            .select('created_at, price, cost_price_at_time, network, size, status')
            .neq('status', 'failed')
            .order('created_at', { ascending: true })

        if (startDate) {
            orderQuery = orderQuery.gte('created_at', startDate)
        }
        if (endDate) {
            orderQuery = orderQuery.lte('created_at', endDate)
        }

        const { data: orders, error: ordersError } = await orderQuery

        if (ordersError) {
            console.error('[ProfitStats] Orders Error:', ordersError)
            throw ordersError
        }

        // Fetch all packages for cost lookup
        const { data: packages } = await supabase
            .from('data_packages')
            .select('network, size, price, cost_price')

        // Fetch user wallet total from atomic RPC instead of loading all users/wallets into memory
        const { data: statsData, error: statsError } = await (supabase.rpc('get_wallet_overview') as any)
        if (statsError) {
            console.error('[ProfitStats] RPC Error:', statsError)
            throw statsError
        }

        const userWalletTotal = statsData?.total_user_balance || 0
        const regularWalletsLength = statsData?.user_count || 0

        return NextResponse.json({
            orders: orders || [],
            packages: packages || [],
            userWalletTotal,
            userCount: regularWalletsLength,
            totalOrdersCount: orders?.length || 0
        })
    } catch (error: any) {
        console.error('Profit Stats Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
