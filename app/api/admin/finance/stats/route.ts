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

        const { searchParams } = new URL(request.url)
        const role = searchParams.get('role')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Calls the optimized Postgres function `get_wallet_stats`
        // eliminating the need to fetch thousands of records to the server.
        // @ts-ignore - Database types not yet updated with new RPC function
        const { data, error } = await (supabase as any)
            .rpc('get_wallet_stats', { role_filter: role || 'all' })

        if (error) {
            throw new Error(`RPC call failed: ${error.message}`)
        }

        // RPC returns an array (even if single row), so we take the first item
        // Explicitly cast to any to avoid 'never' type errors since RPC types are missing
        const stats = (Array.isArray(data) ? data[0] : data) as any

        return NextResponse.json({
            totalBalance: stats?.total_balance ?? 0,
            count: stats?.user_count ?? 0
        })

    } catch (error: any) {
        console.error('Admin Finance Stats Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
