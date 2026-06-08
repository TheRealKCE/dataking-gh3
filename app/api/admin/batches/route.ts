import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { parsePagination } from '@/lib/pagination'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const { limit, offset } = parsePagination(searchParams, { defaultLimit: 50, maxLimit: 200 })
        const network = searchParams.get('network')
        const startDate = searchParams.get('startDate') // ISO string
        const endDate = searchParams.get('endDate') // ISO string
        const search = searchParams.get('search')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Deep Search: If search term provided, find batches containing matching orders
        let batchIdsFromSearch: string[] = []
        if (search) {
            const { data: matchingOrdersRaw } = await supabase
                .from('orders')
                .select('download_batch_id')
                .or(`phone_number.ilike.%${search}%,reference_code.ilike.%${search}%`)
                .not('download_batch_id', 'is', null)
                .limit(100)

            const matchingOrders = matchingOrdersRaw as any[] | null

            if (matchingOrders && matchingOrders.length > 0) {
                batchIdsFromSearch = [...new Set(matchingOrders.map((o: any) => o.download_batch_id))]
            } else {
                // If search yields no orders, return empty result immediately
                return NextResponse.json({ batches: [], totalCount: 0 })
            }
        }

        let query = supabase
            .from('download_batches')
            .select('*', { count: 'exact' })
            .gt('order_count', 0)

        if (batchIdsFromSearch.length > 0) {
            query = query.in('id', batchIdsFromSearch)
        }

        if (network && network !== 'all') {
            query = query.eq('network', network)
        }

        if (startDate) {
            query = query.gte('created_at', startDate)
        }
        if (endDate) {
            query = query.lte('created_at', endDate)
        }

        const { data: batches, count, error: fetchError } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (fetchError) {
            console.error('[AdminBatchesFetch] Error:', fetchError)
            throw fetchError
        }

        return NextResponse.json({
            batches: batches || [],
            totalCount: count || 0
        })
    } catch (error: any) {
        console.error('Admin Batches Fetch Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
