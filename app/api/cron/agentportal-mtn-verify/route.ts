import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { areCronJobsEnabled, cronDisabledResponse } from '@/lib/cron-control'
import { verifyMtnWhitelist, fulfillOrder } from '@/lib/agentportal-service'
import { syncShopOrderStatus } from '@/lib/shop-service'

// Auto-verify / self-heal for MTN whitelist-blocked Agent Portal orders (cron-job.org).
//
// MTN orders to a number that isn't enabled on the account are rejected at the whitelist
// gate (added: 0) and left pending. This cron:
//   1. Finds pending MTN orders.
//   2. Checks their numbers against the MTN whitelist — which ALSO auto-submits any that
//      aren't enabled yet (so the enablement clock, up to 2 weeks, keeps running).
//   3. For numbers that have BECOME enabled, refulfills the order automatically
//      (queue/add → processing), so you never have to manually refulfill.
// Numbers still not enabled are left pending (re-submitted on the next run).

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

function normalizePhone(phone: string): string {
    let p = (phone || '').replace(/\s+/g, '').replace(/-/g, '')
    if (p.startsWith('233')) p = '0' + p.slice(3)
    else if (!p.startsWith('0')) p = '0' + p
    return p
}

export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only run when Agent Portal is the active MTN supplier and auto-fulfillment is on.
    const { data: settingsRows } = await supabaseAdmin
        .from('admin_settings')
        .select('key, value')
        .in('key', ['fulfillment_settings', 'auto_fulfillment_enabled'])
    const settings = (settingsRows || []).reduce((acc: any, r: any) => { acc[r.key] = r.value; return acc }, {})

    if (String(settings.auto_fulfillment_enabled) === 'false') {
        return NextResponse.json({ success: true, skipped: true, reason: 'Global auto-fulfillment disabled' })
    }
    let apMtnEnabled = false
    try {
        const parsed = typeof settings.fulfillment_settings === 'string'
            ? JSON.parse(settings.fulfillment_settings)
            : settings.fulfillment_settings || {}
        apMtnEnabled = parsed?.agentportal_networks?.MTN === true
    } catch { /* leave false */ }
    if (!apMtnEnabled) {
        return NextResponse.json({ success: true, skipped: true, reason: 'Agent Portal not active for MTN' })
    }

    // Pending MTN orders (bounded per run).
    const { data: pending, error: fetchErr } = await supabaseAdmin
        .from('orders')
        .select('id, phone_number, size, network, shop_order_id, status')
        .eq('status', 'pending')
        .eq('network', 'MTN')
        .order('created_at', { ascending: true })
        .limit(100)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!pending || pending.length === 0) {
        return NextResponse.json({ success: true, checked: 0, enabled: 0, fulfilled: 0, waiting: 0, failed: 0 })
    }

    // Verify + auto-submit all their numbers in one batch.
    const phones = Array.from(new Set(pending.map((o: any) => normalizePhone(o.phone_number))))
    const { success: verifyOk, allowed, error: verifyErr } = await verifyMtnWhitelist(phones)
    if (!verifyOk) {
        return NextResponse.json({ success: false, checked: pending.length, error: verifyErr || 'whitelist verify failed' })
    }

    let fulfilled = 0
    let waiting = 0
    let failed = 0
    const errors: string[] = []

    for (const order of pending) {
        const phone = normalizePhone(order.phone_number)
        if (!allowed.has(phone)) { waiting++; continue } // not enabled yet — submitted for verification, wait

        // Number enabled → refulfill. Atomic lock: pending → processing (skip if already taken).
        const { data: locked } = await supabaseAdmin
            .from('orders')
            .update({ status: 'processing' })
            .eq('id', order.id)
            .eq('status', 'pending')
            .select()
            .maybeSingle()
        if (!locked) continue

        try {
            const result = await fulfillOrder(order.network, order.phone_number, order.size, order.id)

            if (result.success) {
                // Stamp reference first (unconstrained), then fulfillment_method.
                if (result.transactionId) {
                    await supabaseAdmin.from('orders').update({ agentportal_reference: result.transactionId }).eq('id', order.id)
                }
                await supabaseAdmin.from('orders').update({ fulfillment_method: 'agentportal' }).eq('id', order.id)

                if (order.shop_order_id) {
                    const upd: Record<string, any> = {
                        status: 'processing',
                        fulfilled_by: 'agentportal',
                        updated_at: new Date().toISOString(),
                    }
                    if (result.transactionId) upd.agentportal_reference = result.transactionId
                    await supabaseAdmin.from('shop_orders').update(upd).eq('id', order.shop_order_id)
                }

                await syncShopOrderStatus(order.id, 'processing').catch((e: any) =>
                    console.error(`[AgentPortalVerify] syncShopOrderStatus failed for ${order.id}:`, e?.message)
                )

                try {
                    await supabaseAdmin.from('mtn_fulfillment_tracking').insert({
                        order_id: order.id,
                        status: 'processing',
                        api_response: { ...(result.apiResponse || {}), note: 'Auto-verify heal: MTN number enabled, refulfilled', supplier: 'agentportal' },
                    })
                } catch { /* tracking is best-effort */ }

                console.log(`[AgentPortalVerify] order ${order.id}: number enabled → refulfilled (processing)`)
                fulfilled++
            } else {
                // Enabled per whitelist but queue/add still rejected (rare race) — revert to pending.
                await supabaseAdmin.from('orders').update({ status: 'pending' }).eq('id', order.id)
                if (order.shop_order_id) {
                    await supabaseAdmin.from('shop_orders').update({ status: 'pending' }).eq('id', order.shop_order_id)
                }
                errors.push(`order ${order.id}: enabled but fulfill failed: ${result.error}`)
                failed++
            }
        } catch (e: any) {
            await supabaseAdmin.from('orders').update({ status: 'pending' }).eq('id', order.id)
            errors.push(`order ${order.id}: ${e?.message}`)
            failed++
        }
    }

    return NextResponse.json({
        success: true,
        checked: pending.length,
        enabled: allowed.size,
        fulfilled,
        waiting,
        failed,
        errors,
    })
}

// Accept any method (cron-job.org's sent method doesn't always match its UI); auth-gated.
export const POST = GET
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
