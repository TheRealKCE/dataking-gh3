import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { finalizeUtilityOrder } from '@/lib/utility-order-completion'
import { triggerUtilityFulfillment } from '@/lib/utility-fulfillment-dispatcher'

async function verifyAdmin(supabaseUserClient: any) {
    const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
    if (authError || !authUser) return null
    const supabase = createServerClient()
    const { data: user } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (user as any)?.role
    if (!['admin', 'sub-admin'].includes(role)) return null
    return { userId: authUser.id, role }
}

// GET — list utility bill orders
export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const service = searchParams.get('service')
        const search = searchParams.get('search')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '30')
        const offset = (page - 1) * limit

        let query = (supabase.from('utility_orders') as any)
            .select(`
                *,
                users!utility_orders_user_id_fkey(first_name, last_name, email, phone_number),
                fulfilled_by_user:users!utility_orders_fulfilled_by_fkey(first_name, last_name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (status && status !== 'all') query = query.eq('status', status)
        if (service && service !== 'all') query = query.eq('service', service)
        if (search) {
            query = query.or(`reference_code.ilike.%${search}%,account_number.ilike.%${search}%,account_name.ilike.%${search}%`)
        }

        const { data: orders, error, count } = await query

        if (error) {
            console.error('[Admin Utilities] List error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            orders: orders || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        })
    } catch (error) {
        console.error('[Admin Utilities] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * PATCH — resolve one order by hand.
 *
 * Three actions, and the distinction between the last two is the whole point:
 *
 *   complete — the bill IS paid (the admin confirmed it in the Hubtel portal, or
 *              paid it another way). Closes the order, no refund.
 *   refund   — the bill was NOT paid. Closes the order and returns the money.
 *   fail     — the bill was not paid but the money has already been handled
 *              elsewhere, or the state is still uncertain. Closes the order and
 *              leaves the balance alone.
 *
 * Everything goes through finalizeUtilityOrder() so a hand-resolved order notifies
 * the customer exactly as an automatic one does.
 */
export async function PATCH(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let body: any
        try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

        const { orderId, action, note } = body

        if (!orderId || !['complete', 'refund', 'fail', 'retry'].includes(action)) {
            return NextResponse.json({ error: 'orderId and a valid action are required' }, { status: 400 })
        }

        // Re-dispatching is only ever safe for an order that never got claimed —
        // dispatch_claimed_at is set before the provider is called, so a claimed
        // order may already have paid the bill and must not be sent again.
        if (action === 'retry') {
            const supabase = createServerClient() as any
            const { data: order } = await supabase
                .from('utility_orders')
                .select('id, status, dispatch_claimed_at')
                .eq('id', orderId)
                .single()

            if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
            if (order.dispatch_claimed_at) {
                return NextResponse.json({
                    error: 'This order was already sent to Hubtel. Confirm its state in the Hubtel portal and complete or refund it by hand — re-sending could pay the bill twice.',
                }, { status: 409 })
            }

            const result = await triggerUtilityFulfillment(orderId)
            return NextResponse.json({ success: result.dispatched, reason: result.reason })
        }

        if ((action === 'fail' || action === 'refund') && !note) {
            return NextResponse.json({ error: 'A note is required when failing or refunding an order' }, { status: 400 })
        }

        const result = await finalizeUtilityOrder({
            orderId,
            status: action === 'complete' ? 'completed' : 'failed',
            note: note || null,
            actorId: admin.userId,
            refund: action === 'refund',
        })

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Could not update the order' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Admin Utilities] PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
