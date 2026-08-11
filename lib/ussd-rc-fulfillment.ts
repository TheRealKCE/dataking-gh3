/**
 * USSD Result Checker Fulfillment
 *
 * Called after a USSD result-checker payment is confirmed. On the Hubtel
 * Programmable Services flow this runs from the Service Fulfilment endpoint
 * (api/hubtel/fulfill) with the Hubtel OrderId as the reference. Assigns a
 * voucher, finalises the sale, sends SMS, and cleans up.
 */
import { createClient } from '@supabase/supabase-js'
import { sendHubtelSMS } from '@/lib/hubtel-sms-service'
import { sendPushToAdmins } from '@/lib/web-push'
import { creditShopRcProfit } from '@/lib/shop-service'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Legacy entry: reference format `USSD-RC-{sessionId}` (Direct Receive Money).
 * Kept for backward compatibility; delegates to the session-based fulfiller.
 */
export async function fulfillUSSDRCOrder(
    clientReference: string,
    amountPaid: number
): Promise<{ success: boolean; error?: string }> {
    const sessionId = clientReference.replace('USSD-RC-', '')
    return fulfillUSSDRCBySession({ sessionId, referenceCode: clientReference, amountPaid })
}

/**
 * Fulfils a USSD result-checker order from a session id and a unique
 * reference/order id (the idempotency key stored on the order record).
 *
 * Non-critical cleanup tasks (admin notifications, session deletion) can be
 * pushed to the deferredWork array to run fire-and-forget after the customer
 * outcome (voucher + SMS) is guaranteed.
 */
export async function fulfillUSSDRCBySession(params: {
    sessionId: string
    referenceCode: string
    amountPaid: number
    deferredWork?: Array<() => Promise<void>>
}): Promise<{ success: boolean; error?: string }> {
    const { sessionId, referenceCode, amountPaid, deferredWork = [] } = params
    const clientReference = referenceCode

    console.log('[USSD-RC Fulfill] Starting fulfillment for sessionId:', sessionId, 'ref:', referenceCode)

    // 1. Look up the session
    const { data: session, error: sessionError } = await supabaseAdmin
        .from('hubtel_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()

    if (sessionError || !session) {
        console.error('[USSD-RC Fulfill] Session not found:', sessionId, sessionError)
        return { success: false, error: 'Session not found' }
    }

    const sessionData = session.data || {}
    const { selectedCheckerId, selectedCheckerName, selectedCheckerPrice, recipientMobile } = sessionData
    const payerMobile = session.mobile

    // Set when the caller entered a shop's short code. Null for the house code,
    // which is ARHMS selling direct exactly as it did before short codes existed.
    const shopId: string | null = sessionData.shopId || null
    const shopName: string | null = sessionData.shopName || null

    if (!selectedCheckerId || !selectedCheckerName) {
        console.error('[USSD-RC Fulfill] Incomplete session data:', sessionData)
        return { success: false, error: 'Incomplete session data' }
    }

    // 1a. Amount verification — never fulfill on an under-payment.
    // Hubtel's AmountCharged may include a transaction fee on top of the price,
    // so we only reject amounts that fall short of the quoted price (with a
    // small tolerance for rounding), not amounts that exceed it.
    const expectedPrice = parseFloat(String(selectedCheckerPrice ?? 0))
    if (expectedPrice > 0 && amountPaid + 0.01 < expectedPrice) {
        console.error(
            `[USSD-RC Fulfill] AMOUNT MISMATCH for ${clientReference}: expected >= GHS ${expectedPrice}, got GHS ${amountPaid}`
        )
        // Defer admin notification (non-critical)
        deferredWork.push(() =>
            sendPushToAdmins({
                title: '⚠️ USSD RC Underpayment',
                body: `Paid GHS ${amountPaid} for ${selectedCheckerName} priced GHS ${expectedPrice}. Ref: ${clientReference}`,
                url: '/admin/vouchers',
            }).catch(() => {})
        )
        return { success: false, error: 'Amount paid is less than the checker price' }
    }

    // 2. Idempotency — check for existing completed order
    const { data: existingOrder } = await supabaseAdmin
        .from('results_checker_orders')
        .select('id, status')
        .eq('reference_code', clientReference)
        .maybeSingle()

    if (existingOrder?.status === 'completed') {
        console.log('[USSD-RC Fulfill] Already fulfilled:', clientReference)
        return { success: true }
    }

    // 3. Create a pending order record (upsert to handle retries)
    const orderId = existingOrder?.id || crypto.randomUUID()

    // The shop's margin over the platform's own customer price. Resolved before the
    // insert so the order row records what the shop earned on this sale.
    let shopMarkup = 0
    if (shopId) {
        const { data: checkerType } = await supabaseAdmin
            .from('results_checker_types')
            .select('customer_price')
            .eq('id', selectedCheckerId)
            .maybeSingle()
        const platformCost = parseFloat(String(checkerType?.customer_price ?? 0))
        shopMarkup = Math.max(0, expectedPrice - platformCost)
    }

    if (!existingOrder) {
        const { error: insertErr } = await supabaseAdmin
            .from('results_checker_orders')
            .insert({
                id: orderId,
                user_id: null,
                shop_id: shopId,
                shop_name: shopName,
                shop_markup: shopMarkup,
                customer_phone: recipientMobile || payerMobile,
                type_id: selectedCheckerId,
                type_name: selectedCheckerName,
                quantity: 1,
                unit_price: selectedCheckerPrice || amountPaid,
                total_paid: amountPaid,
                status: 'pending',
                payment_status: 'completed',
                reference_code: clientReference,
            })

        if (insertErr) {
            console.error('[USSD-RC Fulfill] Failed to create order record:', insertErr)
            return { success: false, error: 'Failed to create order record' }
        }
    }

    // 4. Lock a voucher
    const { data: reserved, error: reserveErr } = await supabaseAdmin
        .rpc('assign_results_checker_vouchers', {
            p_type_id: selectedCheckerId,
            p_quantity: 1,
            p_order_id: orderId,
        })

    if (reserveErr || !reserved || reserved.length === 0) {
        console.error('[USSD-RC Fulfill] assign_results_checker_vouchers failed:', reserveErr)

        await supabaseAdmin
            .from('results_checker_orders')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', orderId)

        // Defer admin notification (non-critical)
        deferredWork.push(() =>
            sendPushToAdmins({
                title: '⚠️ USSD RC Fulfillment Failed',
                body: `Out of stock: ${selectedCheckerName}. Ref: ${clientReference}`,
                url: '/admin/vouchers',
            }).catch(() => {})
        )

        return { success: false, error: 'Insufficient voucher stock' }
    }

    const voucher = reserved[0]

    // 5. Finalise the sale
    await supabaseAdmin
        .rpc('finalize_results_checker_sale', {
            p_order_id: orderId,
            p_user_id: null,
        })

    // 6. Mark order completed
    await supabaseAdmin
        .from('results_checker_orders')
        .update({
            status: 'completed',
            payment_status: 'completed',
            inventory_ids: [voucher.id],
            delivered_via: ['sms'],
            fulfilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

    // 6b. Credit the shop's markup. Runs before the SMS so a crash in delivery
    // still leaves the shop paid for a voucher that was genuinely sold; the
    // helper is idempotent on the reference, so a retry cannot double-credit.
    if (shopId && shopMarkup > 0) {
        const { data: shopRow } = await supabaseAdmin
            .from('shop_profiles')
            .select('owner_id')
            .eq('id', shopId)
            .maybeSingle()

        if (shopRow?.owner_id) {
            await creditShopRcProfit({
                ownerId: shopRow.owner_id,
                amount: shopMarkup,
                description: `USSD RC sale: ${selectedCheckerName}`,
                reference: clientReference,
            })
        }
    }

    // 7. Send PIN & Serial via Hubtel SMS
    const recipientPhone = recipientMobile || payerMobile
    const smsResult = await sendHubtelSMS({
        recipient: recipientPhone,
        message:
            `Your ${selectedCheckerName} Result Checker is ready!\n\n` +
            `PIN: ${voucher.pin}\n` +
            `Serial: ${voucher.serial_number}\n\n` +
            `Visit waecdirect.org to check your results.\n\nARHMS DATA`,
    })

    console.log('[USSD-RC Fulfill] SMS result:', smsResult)

    // 8 & 9 are deferred: admin push and session cleanup are not on the critical path.
    // They fire-and-forget after the Hubtel callback, so don't block the customer-facing response.
    deferredWork.push(async () => {
        // 8. Notify admins
        await sendPushToAdmins({
            title: '✅ USSD RC Sale',
            body: `${selectedCheckerName} sold to ${recipientPhone}. Ref: ${clientReference}`,
            url: '/admin/vouchers',
        }).catch(() => {})

        // 9. Clean up session
        try {
            await supabaseAdmin.from('hubtel_sessions').delete().eq('session_id', sessionId)
        } catch {
            // Best effort — a stale session row is harmless.
        }
    })

    console.log('[USSD-RC Fulfill] Successfully fulfilled order:', orderId)
    return { success: true }
}
