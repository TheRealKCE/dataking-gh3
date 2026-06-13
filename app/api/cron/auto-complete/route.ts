import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { areCronJobsEnabled, cronDisabledResponse, isValidCronRequest } from '@/lib/cron-control'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    if (!isValidCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Load settings ────────────────────────────────────────────────────────
    const { data: settingsData } = await supabaseAdmin
        .from('admin_settings')
        .select('key, value')
        .in('key', [
            'cron_auto_complete_enabled',
            'cron_auto_complete_delay_minutes',
        ])

    const s = (settingsData || []).reduce((acc: Record<string, string>, r: any) => {
        acc[r.key] = r.value
        return acc
    }, {})

    if (s.cron_auto_complete_enabled !== 'true') {
        return NextResponse.json({ skipped: true, reason: 'Auto-Complete cron is disabled in admin settings' })
    }

    const delayMinutes = Math.max(1, parseInt(s.cron_auto_complete_delay_minutes || '30'))
    const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString()

    // ── Fetch processing orders older than the configured delay (max 50) ─────
    const { data: processingOrders, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('id, shop_order_id, user_id, network, size, price, phone_number')
        .eq('status', 'processing')
        .lt('updated_at', cutoff)
        .order('updated_at', { ascending: true })
        .limit(50)

    if (fetchError) {
        console.error('[CronAutoComplete] DB fetch error:', fetchError)
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!processingOrders || processingOrders.length === 0) {
        return NextResponse.json({ success: true, completed: 0, message: 'No processing orders past the delay threshold' })
    }

    let completed = 0
    let failed = 0

    for (const order of processingOrders) {
        try {
            const now = new Date().toISOString()

            // Mark main order as completed
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({ status: 'completed', updated_at: now })
                .eq('id', order.id)
                .eq('status', 'processing') // Safety: only if still processing

            if (updateError) {
                console.error(`[CronAutoComplete] Failed to complete order ${order.id}:`, updateError.message)
                failed++
                continue
            }

            // Mirror to shop_orders if this order came from a storefront
            if (order.shop_order_id) {
                await supabaseAdmin
                    .from('shop_orders')
                    .update({ status: 'completed', updated_at: now })
                    .eq('id', order.shop_order_id)
            }

            // Sync the shop order status wrapper
            try {
                const { syncShopOrderStatus } = await import('@/lib/shop-service')
                await syncShopOrderStatus(order.id, 'completed')
            } catch (syncErr) {
                console.error(`[CronAutoComplete] syncShopOrderStatus failed for ${order.id}:`, syncErr)
            }

            console.log(`[CronAutoComplete] ✅ Auto-completed order ${order.id}`)
            completed++
        } catch (err: any) {
            console.error(`[CronAutoComplete] Error processing order ${order.id}:`, err.message)
            failed++
        }
    }

    console.log(`[CronAutoComplete] Done — completed:${completed} failed:${failed}`)
    return NextResponse.json({
        success: true,
        total: processingOrders.length,
        completed,
        failed,
        delayMinutes,
    })
}
