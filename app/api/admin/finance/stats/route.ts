import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
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
        const role = searchParams.get('role')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Calls the optimized Postgres function `get_wallet_stats`
        // eliminating the need to fetch thousands of records to the server.
        // @ts-ignore - Database types not yet updated with new RPC function
        const { data, error } = await supabase
            .rpc('get_wallet_stats', { role_filter: role || 'all' })

        if (error) {
            throw new Error(`RPC call failed: ${error.message}`)
        }

        // RPC returns an array (even if single row), so we take the first item
        // Explicitly cast to any to avoid 'never' type errors since RPC types are missing
        const stats = (Array.isArray(data) ? data[0] : data) as any

        return NextResponse.json({
            totalBalance: stats?.total_balance ?? 0,
            totalCredited: stats?.total_credited ?? 0,
            totalSpent: stats?.total_spent ?? 0,
            count: stats?.user_count ?? 0
        })

    } catch (error: any) {
        console.error('Admin Finance Stats Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
