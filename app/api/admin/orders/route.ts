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
        const available = searchParams.get('available') === 'true'
        const batchId = searchParams.get('batchId')
        const batchIds = searchParams.get('batchIds')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        let query = supabase
            .from('orders')
            .select(`
                *,
                users (
                    first_name,
                    last_name,
                    email
                )
            `, { count: 'exact' })

        if (batchIds) {
            query = query.in('download_batch_id', batchIds.split(','))
        } else if (batchId) {
            query = query.eq('download_batch_id', batchId)
        } else if (available) {
            query = query.is('download_batch_id', null).eq('status', 'pending')
        }

        const { data: orders, count, error: fetchError } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (fetchError) {
            console.error('[AdminOrdersFetch] Error:', fetchError)
            throw fetchError
        }

        // Since cost_price is now saved during purchase, most records will have it.
        // We remove the expensive server-side O(N^2) loop that was matching packages to orders.
        // This significantly reduces Fluid Active CPU usage.

        return NextResponse.json({
            orders: orders || [],
            totalCount: count || 0
        })
    } catch (error: any) {
        console.error('Admin Orders Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
