/**
 * USSD Data Bundle Fulfillment
 *
 * Called from the Hubtel Service Fulfilment endpoint after a USSD data-bundle
 * payment is confirmed. This is deliberately thin: everything that matters —
 * idempotency, server-side price re-derivation, shop_orders + orders inserts,
 * customer SMS, shop wallet credit and supplier dispatch — already lives in
 * processShopOrder, which the web storefront has used in production for months.
 * Reimplementing any of it here would be a second, divergent copy.
 */
import { createClient } from '@supabase/supabase-js'
import { processShopOrder } from '@/lib/shop-order-processor'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function fulfillUSSDDataBySession(params: {
    sessionId: string
    referenceCode: string
    amountPaid: number
    deferredWork?: Array<() => Promise<void>>
}): Promise<{ success: boolean; error?: string }> {
    const { sessionId, referenceCode, amountPaid, deferredWork = [] } = params

    console.log('[USSD-Data Fulfill] Starting fulfillment for sessionId:', sessionId, 'ref:', referenceCode)

    const { data: session, error: sessionError } = await supabaseAdmin
        .from('hubtel_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()

    if (sessionError || !session) {
        console.error('[USSD-Data Fulfill] Session not found:', sessionId, sessionError)
        return { success: false, error: 'Session not found' }
    }

    const sessionData = session.data || {}
    const { shopId, selectedPackageId, packageSize, network, recipientMobile } = sessionData

    if (!shopId || !selectedPackageId || !network) {
        console.error('[USSD-Data Fulfill] Incomplete session data:', sessionData)
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
            package_id: selectedPackageId,
            guest_phone: recipientMobile || session.mobile,
            network,
            package_size: packageSize,
            order_type: 'data',
            channel: 'ussd',
        },
        Math.round(amountPaid * 100),
        (shop as any)?.shop_slug
    )

    if (!result.success) {
        console.error('[USSD-Data Fulfill] processShopOrder failed:', result.error)
        return { success: false, error: result.error }
    }

    // Session cleanup is not on the critical path — the customer's bundle is
    // already dispatched by the time we get here.
    deferredWork.push(async () => {
        try {
            await supabaseAdmin.from('hubtel_sessions').delete().eq('session_id', sessionId)
        } catch {
            // Best effort — a stale session row is harmless.
        }
    })

    console.log('[USSD-Data Fulfill] Successfully fulfilled order:', result.orderId)
    return { success: true }
}
