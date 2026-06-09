import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { validateAdminAccess } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }
        const { supabase: supabaseUserClient } = authResult

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Optimization: Use RPC for heavy aggregations (sums, counts)
        // This avoids fetching thousands of rows into memory
        const { data: stats, error: rpcError } = await supabase.rpc('get_admin_dashboard_stats')

        if (!rpcError && stats) {
            return NextResponse.json(stats)
        }

        console.warn('[AdminStats] RPC failed or not found, falling back to counts:', rpcError?.message)

        // Fallback: Fetch counts only (lightweight)
        // Sums (Revenue, Wallet Balance) will be 0 in fallback to avoid CPU spike
        const [usersRes, ordersRes, pendingRes, todayRes] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
            supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0])
        ])

        return NextResponse.json({
            totalUsers: usersRes.count || 0,
            totalOrders: ordersRes.count || 0,
            completedOrders: (ordersRes.count || 0) - (pendingRes.count || 0), // Estimate
            pendingOrders: pendingRes.count || 0,
            totalRevenue: 0, // Sums require RPC or row-fetching
            totalWalletBalance: 0, // Sums require RPC or row-fetching
            successRate: 0,
            todayOrders: todayRes.count || 0
        })
    } catch (error: any) {
        console.error('Admin Stats Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
