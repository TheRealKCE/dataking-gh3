import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendAirtimeBeneficiarySMS, sendAirtimeCompletedSMS } from '@/lib/sms-service'

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
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
            supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
        })
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const network = searchParams.get('network')
        const search = searchParams.get('search')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '30')
        const offset = (page - 1) * limit

        let query = (supabase.from('airtime_orders') as any)
            .select(`
                *,
                users!airtime_orders_user_id_fkey(first_name, last_name, email, phone_number),
                fulfilled_by_user:users!airtime_orders_fulfilled_by_fkey(first_name, last_name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (status && status !== 'all') query = query.eq('status', status)
        if (network && network !== 'all') query = query.eq('network', network)
        if (search) {
            query = query.or(`reference_code.ilike.%${search}%,beneficiary_phone.ilike.%${search}%`)
        }

        const { data: orders, error, count } = await query

        if (error) {
            console.error('[Admin Airtime] List error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            orders: orders || [],
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
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
            supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
        })
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

        const updatePayload: any = {
            status,
            fulfilled_by: admin.userId,
            fulfilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }
        if (fulfillmentNote) updatePayload.fulfillment_note = fulfillmentNote

        const { error: updateError } = await (supabase.from('airtime_orders') as any)
            .update(updatePayload).eq('id', orderId)

        if (updateError) {
            console.error('[Admin Airtime] Update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        // SYNC: If this is a shop order, sync the status downward.
        if (existing.reference_code && existing.reference_code.startsWith('SHOP-')) {
            const refSuffix = existing.reference_code.replace('SHOP-', '')
            
            // 1. Update orders table (which uses the 10-char truncated reference)
            await (supabase.from('orders') as any).update({ status }).eq('reference_code', existing.reference_code)
            
            // 2. Update shop_orders (which uses the full paystack reference)
            const { data: sOrder } = await (supabase.from('shop_orders') as any)
                .select('id')
                .ilike('paystack_reference', `%${refSuffix}`)
                .single()
                
            if (sOrder?.id) {
                await (supabase.from('shop_orders') as any)
                    .update({ status, updated_at: new Date().toISOString() })
                    .eq('id', sOrder.id)
            }
        }

        // Update the user's in-app notification
        ;(supabase.from('notifications') as any).insert({
            user_id: existing.user_id,
            title: status === 'completed' ? 'Airtime Sent ✅' : 'Airtime Order Failed',
            message: status === 'completed'
                ? `GHS ${existing.airtime_amount.toFixed(2)} airtime for ${existing.beneficiary_phone} has been sent successfully. Ref: ${existing.reference_code}`
                : `Your airtime order ${existing.reference_code} could not be completed. Please contact support.`,
            type: 'order_update',
            action_url: '/dashboard/airtime',
        }).then(() => {}).catch((e: any) => console.error('[Admin Airtime] Notification error:', e))

        // Trigger the completed SMS alert
        if (status === 'completed') {
            sendAirtimeCompletedSMS(existing.beneficiary_phone, existing.airtime_amount)
                .catch(err => console.error('[Admin Airtime] Completed SMS failed:', err))
        }

        return NextResponse.json({ success: true, status })
    } catch (error) {
        console.error('[Admin Airtime] Unexpected PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
