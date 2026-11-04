/**
 * USSD Shop Airtime Fulfillment
 *
 * Called by lib/ussd-settle.ts once a shop's USSD airtime sale is paid. Like the shop's
 * data bundles (lib/ussd-data-fulfillment.ts), it hands the order to processShopOrder,
 * which the web storefront already settles shop airtime with: it re-prices the order from
 * the shop's fees and refuses a mismatched amount, writes shop_orders and airtime_orders,
 * credits the owner's profit and dispatches the top-up.
 *
 * The order is priced the way the caller saw it (lib/ussd-airtime.ts, quoteShopAirtime):
 * exact-amount mode, so the beneficiary gets the typed amount and the fees are on top.
 */

import { processShopOrder } from '@/lib/shop-order-processor'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function fulfillUSSDShopAirtimeBySession(params: {
    sessionId: string
    referenceCode: string
    amountPaid: number
    deferredWork?: Array<() => Promise<void>>
}): Promise<{ success: boolean; error?: string }> {
    const { sessionId, referenceCode, amountPaid, deferredWork = [] } = params

    console.log('[USSD-ShopAirtime Fulfill] Starting fulfillment for sessionId:', sessionId, 'ref:', referenceCode)

    const { data: session, error: sessionError } = await supabaseAdmin
        .from('hubtel_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()

    if (sessionError || !session) {
        console.error('[USSD-ShopAirtime Fulfill] Session not found:', sessionId, sessionError)
        return { success: false, error: 'Session not found' }
    }

    const sessionData = session.data || {}
    const { shopId } = sessionData
    const air = sessionData.air || {}
    const amount = Number(air.amount)

    if (!shopId || !air.phone || !air.network || !(amount > 0)) {
        console.error('[USSD-ShopAirtime Fulfill] Incomplete session data:', referenceCode)
        return { success: false, error: 'Incomplete session data' }
    }

    const { data: shop } = await supabaseAdmin
        .from('shop_profiles')
        .select('shop_slug')
        .eq('id', shopId)
        .maybeSingle()

    const result = await processShopOrder(
        referenceCode,
        {
            shop_id: shopId,
            // Airtime has no package; the processor's own airtime path ignores it.
            package_id: '',
            guest_phone: air.phone,
            network: air.network,
            package_size: `GHS ${amount.toFixed(2)} Airtime`,
            order_type: 'airtime',
            type: 'airtime',
            airtime_amount: amount,
            original_amount: amount,
            use_exact_amount: true,
            channel: 'ussd',
        },
        Math.round(amountPaid * 100),
        (shop as any)?.shop_slug
    )

    if (!result.success) {
        console.error('[USSD-ShopAirtime Fulfill] processShopOrder failed:', result.error)
        return { success: false, error: result.error }
    }

    // Session cleanup is not on the critical path — the top-up is already dispatched.
    deferredWork.push(async () => {
        try {
            await supabaseAdmin.from('hubtel_sessions').delete().eq('session_id', sessionId)
        } catch {
            // Best effort — a stale session row is harmless.
        }
    })

    console.log('[USSD-ShopAirtime Fulfill] Successfully fulfilled order:', result.orderId)
    return { success: true }
}
