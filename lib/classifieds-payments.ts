import { createServerClient } from './supabase'
import { sendPushToUser } from './web-push'

const TIER_DAYS: Record<string, number> = {
    '7d': 7,
    '14d': 14,
    '21d': 21,
    '30d': 30,
    '60d': 60,
    '90d': 90,
}

/**
 * Processes a completed listing boost payment.
 * Called by both Paystack and Moolre webhooks (and the inline verify route)
 * when a BOOST- reference payment is confirmed successful.
 * This function is idempotent.
 */
export async function processBoostPayment(reference: string, providerMetadata?: any) {
    const supabase = createServerClient()

    // 1. Fetch the payment record
    const { data: paymentData, error: paymentError } = await (supabase
        .from('wallet_payments') as any)
        .select('*')
        .eq('reference', reference)
        .single()

    if (paymentError || !paymentData) {
        console.error('[BoostProcess] Payment record not found:', reference)
        return { success: false, error: 'Payment not found' }
    }

    const payment = paymentData as any

    // 2. Idempotency — only process if still pending
    const { data: updatedPayment, error: updateError } = await (supabase
        .from('wallet_payments') as any)
        .update({
            status: 'completed',
            metadata: providerMetadata || payment.metadata,
            updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .eq('status', 'pending')
        .select()
        .single()

    if (updateError) {
        if (updateError.code === 'PGRST116') {
            // Already processed — idempotent success
            return { success: true, alreadyProcessed: true }
        }
        console.error('[BoostProcess] Update payment error:', updateError)
        return { success: false, error: 'Failed to update payment status' }
    }

    if (!updatedPayment) {
        return { success: true, alreadyProcessed: true }
    }

    // 3. Extract boost metadata
    const meta = typeof payment.metadata === 'string'
        ? JSON.parse(payment.metadata)
        : (payment.metadata || {})

    const listingId: string = meta.listing_id
    const tier: string = meta.tier
    const sellerId: string = payment.user_id

    if (!listingId || !tier || !TIER_DAYS[tier]) {
        console.error('[BoostProcess] Missing listing_id or tier in payment metadata:', meta)
        return { success: false, error: 'Invalid boost metadata' }
    }

    const now = new Date()
    const endsAt = new Date(now.getTime() + TIER_DAYS[tier] * 24 * 60 * 60 * 1000)

    // 4. Insert boost record
    const { error: boostInsertError } = await (supabase
        .from('classified_boosts') as any)
        .insert({
            listing_id: listingId,
            seller_id: sellerId,
            tier,
            amount_paid: payment.amount,
            starts_at: now.toISOString(),
            ends_at: endsAt.toISOString(),
        })

    if (boostInsertError) {
        console.error('[BoostProcess] Insert boost error:', boostInsertError)
        return { success: false, error: 'Failed to record boost' }
    }

    // 5. Update listing is_boosted status
    const { error: listingUpdateError } = await (supabase
        .from('classified_listings') as any)
        .update({
            is_boosted: true,
            boosted_until: endsAt.toISOString(),
            boost_tier: tier,
        })
        .eq('id', listingId)

    if (listingUpdateError) {
        console.error('[BoostProcess] Listing update error:', listingUpdateError)
        // Not fatal — boost record was created
    }

    // 6. Send push notification to seller
    await sendPushToUser(sellerId, {
        title: '🚀 Listing Boosted!',
        body: `Your listing is now boosted for ${TIER_DAYS[tier]} days!`,
        url: '/classifieds/my-listings',
    }).catch((e: any) => console.error('[BoostProcess] Push error:', e))

    // 7. Create in-app notification
    await (supabase.from('notifications') as any).insert({
        user_id: sellerId,
        title: '🚀 Listing Boosted!',
        message: `Your listing has been boosted for ${TIER_DAYS[tier]} days. It is now featured at the top of the marketplace.`,
        type: 'system',
        action_url: '/classifieds/my-listings',
    }).catch((e: any) => console.error('[BoostProcess] Notification error:', e))

    console.log(`[BoostProcess] Boost processed: listing=${listingId}, tier=${tier}, ends=${endsAt.toISOString()}`)
    return { success: true, boosted_until: endsAt.toISOString() }
}
