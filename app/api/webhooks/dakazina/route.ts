import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { syncShopOrderStatus } from '@/lib/shop-service'

export async function POST(request: NextRequest) {
    try {
        let payload: any;
        try {
            payload = await request.json()
        } catch (err) {
            console.error('[DakazinaWebhook] Failed to parse payload:', err)
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
        }

        const { order_code, reference, status, type } = payload

        // 1. Handle Test Event
        if (type === 'test_event') {
            console.log(`[DakazinaWebhook] Test event received: order_code=${order_code}, ref=${reference}`)
            return NextResponse.json({ success: true, message: 'Test event ignored' }, { status: 200 })
        }

        // 2. Filter Statuses: ONLY process 'DELIVERED'
        const upperStatus = (status || '').toUpperCase()
        if (upperStatus !== 'DELIVERED') {
            console.log(`[DakazinaWebhook] Ignored non-deliverable status '${upperStatus}' for order_code=${order_code}`)
            return NextResponse.json({ success: true, message: `Ignored status ${upperStatus}` }, { status: 200 })
        }

        if (!order_code) {
            console.error('[DakazinaWebhook] No order_code in payload')
            return NextResponse.json({ success: true }, { status: 200 }) // Return 200 to prevent retries
        }

        const supabase = createServerClient()

        // 3. Lookup Order
        console.log(`[DakazinaWebhook] Processing DELIVERED status for order_code=${order_code}`)

        const { data: order, error: findError } = await (supabase
            .from('orders') as any)
            .select('id, status, shop_order_id')
            .eq('id', order_code)
            .maybeSingle()

        if (findError) {
            console.error(`[DakazinaWebhook] DB Error looking up order ${order_code}:`, findError.message)
            return NextResponse.json({ success: true }, { status: 200 })
        }

        if (!order) {
            console.log(`[DakazinaWebhook] Order ${order_code} not found in DB`)
            return NextResponse.json({ success: true }, { status: 200 })
        }

        // 4. Idempotency Check
        if (order.status === 'completed') {
            console.log(`[DakazinaWebhook] Order ${order_code} is already completed. Skipping.`)
            return NextResponse.json({ success: true }, { status: 200 })
        }

        if (!['pending', 'processing'].includes(order.status)) {
            console.log(`[DakazinaWebhook] Order ${order_code} is in status ${order.status}. Skipping.`)
            return NextResponse.json({ success: true }, { status: 200 })
        }

        // 5. Apply Update
        const { error: updateError } = await (supabase
            .from('orders') as any)
            .update({ 
                status: 'completed', 
                updated_at: new Date().toISOString() 
            })
            .eq('id', order.id)

        if (updateError) {
            console.error(`[DakazinaWebhook] Failed to update order ${order.id}:`, updateError.message)
            return NextResponse.json({ success: true }, { status: 200 }) // Keep Dakazina quiet
        }

        console.log(`[DakazinaWebhook] Successfully updated order ${order.id} to completed.`)

        // 6. Sync to Storefront if applicable
        if (order.shop_order_id) {
            await syncShopOrderStatus(order.id, 'completed')
                .catch(err => console.error(`[DakazinaWebhook] Sync to shop_order ${order.shop_order_id} failed:`, err))
        }

        return NextResponse.json({ success: true }, { status: 200 })

    } catch (error: any) {
        console.error('[DakazinaWebhook] Unhandled exception:', error)
        return NextResponse.json({ success: true }, { status: 200 })
    }
}
