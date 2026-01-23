import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = createRouteHandlerClient({ cookies })
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

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Fetch data in parallel
        const [usersRes, ordersRes, walletsRes] = await Promise.all([
            // 1. Fetch users count
            supabase
                .from('users')
                .select('*', { count: 'exact', head: true }),

            // 2. Fetch orders for stats
            supabase
                .from('orders')
                .select('status, price, created_at'),

            // 3. Fetch wallets for balance
            supabase
                .from('wallets')
                .select('balance')
        ])

        const usersCount = usersRes.count
        const orders = ordersRes.data
        const wallets = walletsRes.data

        const totalOrders = orders?.length || 0
        const completedOrders = (orders as any[])?.filter(o => o.status === 'completed').length || 0
        const pendingOrders = (orders as any[])?.filter(o => o.status === 'pending' || o.status === 'processing').length || 0
        const totalRevenue = (orders as any[])?.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.price, 0) || 0
        const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0

        const today = new Date().toISOString().split('T')[0]
        const todayOrders = (orders as any[])?.filter(o => o.created_at.startsWith(today)).length || 0
        const totalWalletBalance = (wallets as any[])?.reduce((sum, w) => sum + w.balance, 0) || 0

        return NextResponse.json({
            totalUsers: usersCount || 0,
            totalOrders,
            completedOrders,
            pendingOrders,
            totalRevenue,
            totalWalletBalance,
            successRate,
            todayOrders
        })
    } catch (error: any) {
        console.error('Admin Stats Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
