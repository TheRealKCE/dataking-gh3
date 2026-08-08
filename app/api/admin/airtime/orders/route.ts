import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { finalizeAirtimeOrder } from '@/lib/airtime-order-completion'

async function verifyAdmin(supabaseUserClient: any) {
    const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
    if (authError || !authUser) return null
    const supabase = createServerClient()
    const { data: user } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (user as any)?.role
    if (!['admin', 'sub-admin'].includes(role)) return null
    return { userId: authUser.id, role }
}

// GET — list all airtime orders (admin)
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const network = searchParams.get('network')
        const search = searchParams.get('search')
        const orderType = searchParams.get('type') // 'airtime' | 'mashup' | null (all)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '30')
        const offset = (page - 1) * limit

        let query = (supabase.from('airtime_orders') as any)
            .select(`
                *,
                type,
                bundle_preference,
                users!airtime_orders_user_id_fkey(first_name, last_name, email, phone_number),
                fulfilled_by_user:users!airtime_orders_fulfilled_by_fkey(first_name, last_name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (status && status !== 'all') query = query.eq('status', status)
        if (network && network !== 'all') query = query.eq('network', network)
        if (orderType && orderType !== 'all') query = query.eq('type', orderType)
        if (search) {
            query = query.or(`reference_code.ilike.%${search}%,beneficiary_phone.ilike.%${search}%`)
        }

        const { data: orders, error, count } = await query

        if (error) {
            console.error('[Admin Airtime] List error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Attach the Hubtel top-up legs so the page can show "2/3 delivered" on a
        // split order. Fetched in one query for the page rather than joined, because
        // most orders have no legs at all and PostgREST would nest an empty array on
        // every row regardless.
        const orderIds = (orders || []).map((o: any) => o.id)
        const legsByOrder: Record<string, any[]> = {}
        if (orderIds.length > 0) {
            const { data: legs } = await (supabase.from('airtime_fulfillment_legs') as any)
                .select('order_id, leg_index, amount, status, transaction_id, message')
                .in('order_id', orderIds)
                .order('leg_index', { ascending: true })

            for (const leg of (legs || [])) {
                (legsByOrder[leg.order_id] ||= []).push(leg)
            }
        }

        return NextResponse.json({
            orders: (orders || []).map((o: any) => ({ ...o, fulfillment_legs: legsByOrder[o.id] || [] })),
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        })
    } catch (error) {
        console.error('[Admin Airtime] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH — update order status (admin)
export async function PATCH(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        let body: any
        try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

        const { orderId, status, fulfillmentNote } = body

        if (!orderId || !status) return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 })
        if (!['processing', 'completed', 'failed'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }
        if (status === 'failed' && !fulfillmentNote) {
            return NextResponse.json({ error: 'A reason note is required when marking as failed' }, { status: 400 })
        }

        // Fetch existing order
        const { data: existing, error: fetchError } = await (supabase.from('airtime_orders') as any)
            .select('*').eq('id', orderId).single()

        if (fetchError || !existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

        // The row update, the storefront sync and every notification live in
        // lib/airtime-order-completion.ts so a manual completion and a provider
        // completion do exactly the same thing.
        const result = await finalizeAirtimeOrder({
            orderId,
            status,
            note: fulfillmentNote,
            actorId: admin.userId,
            existingOrder: existing,
        })

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to update order' }, { status: 500 })
        }

        return NextResponse.json({ success: true, status })
    } catch (error) {
        console.error('[Admin Airtime] Unexpected PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
