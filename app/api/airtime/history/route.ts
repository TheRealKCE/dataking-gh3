import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { parsePagination } from '@/lib/pagination'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id

        const { searchParams } = new URL(request.url)
        const { page, limit, from, to } = parsePagination(searchParams, { defaultLimit: 50, maxLimit: 100 })
        const typeFilter = searchParams.get('type') // 'airtime' | 'mashup' | null (all)

        let query = (supabaseUserClient.from('airtime_orders') as any)
            .select('id, reference_code, network, beneficiary_phone, airtime_amount, fee_amount, total_paid, status, created_at, use_exact_amount, type, bundle_preference', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (typeFilter && typeFilter !== 'all') {
            query = query.eq('type', typeFilter)
        }

        const { data: orders, error, count } = await query

        if (error) {
            console.error('[Airtime History] Error:', error)
            return NextResponse.json({ error: 'Failed to fetch airtime history' }, { status: 500 })
        }

        return NextResponse.json({
            orders: orders || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        })
    } catch (error) {
        console.error('[Airtime History] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
