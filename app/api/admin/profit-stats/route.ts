import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Fetch ALL orders except failed from ALL users
        let orderQuery = supabase
            .from('orders')
            .select('created_at, price, cost_price, network, size, status')
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

        // Fetch all user wallet balances (excluding admins)
        const { data: users } = await supabase
            .from('users')
            .select('id, wallet_balance, role') as any

        const regularUsers = (users || []).filter((u: any) =>
            u.role !== 'admin' && u.role !== 'sub-admin'
        )
        const userWalletTotal = regularUsers.reduce((sum: number, user: any) =>
            sum + (Number(user.wallet_balance) || 0), 0
        )

        return NextResponse.json({
            orders: orders || [],
            packages: packages || [],
            userWalletTotal,
            userCount: regularUsers.length,
            totalOrdersCount: orders?.length || 0
        })
    } catch (error: any) {
        console.error('Profit Stats Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
