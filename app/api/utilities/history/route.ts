import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { parsePagination } from '@/lib/pagination'

/**
 * The signed-in user's own utility bill payments.
 *
 * Goes through the user-scoped client so RLS is what enforces ownership, matching
 * app/api/airtime/history/route.ts. provider_response is deliberately not selected —
 * it holds raw Hubtel payloads that only /admin/utilities has any use for.
 */
export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const { page, limit, from, to } = parsePagination(searchParams, { defaultLimit: 50, maxLimit: 100 })
        const serviceFilter = searchParams.get('service')

        let query = (supabaseUserClient.from('utility_orders') as any)
            .select(
                'id, reference_code, service, account_number, account_name, bill_amount, fee_amount, total_paid, ' +
                'status, payment_method, payment_status, fulfillment_note, created_at',
                { count: 'exact' }
            )
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (serviceFilter && serviceFilter !== 'all') {
            query = query.eq('service', serviceFilter)
        }

        const { data: orders, error, count } = await query

        if (error) {
            console.error('[Utility History] Error:', error)
            return NextResponse.json({ error: 'Failed to fetch bill payment history' }, { status: 500 })
        }

        return NextResponse.json({
            orders: orders || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        })
    } catch (error) {
        console.error('[Utility History] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
