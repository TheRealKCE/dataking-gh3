/**
 * USSD Result Checker Fulfillment
 *
 * Called by the Hubtel webhook (api/webhooks/hubtel) after a USSD-RC-* payment
 * is confirmed. Assigns a voucher, finalises the sale, sends SMS, and cleans up.
 */
import { createClient } from '@supabase/supabase-js'
import { sendHubtelSMS } from '@/lib/hubtel-sms-service'
import { sendPushToAdmins } from '@/lib/web-push'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function fulfillUSSDRCOrder(
    clientReference: string,
    amountPaid: number
): Promise<{ success: boolean; error?: string }> {
    // Extract sessionId from reference format: USSD-RC-{sessionId}
    const sessionId = clientReference.replace('USSD-RC-', '')

    console.log('[USSD-RC Fulfill] Starting fulfillment for sessionId:', sessionId)

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
        await sendPushToAdmins({
            title: '⚠️ USSD RC Underpayment',
            body: `Paid GHS ${amountPaid} for ${selectedCheckerName} priced GHS ${expectedPrice}. Ref: ${clientReference}`,
            url: '/admin/vouchers',
        }).catch(() => {})
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

    if (!existingOrder) {
        const { error: insertErr } = await supabaseAdmin
            .from('results_checker_orders')
            .insert({
                id: orderId,
                user_id: null,
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

        await sendPushToAdmins({
            title: '⚠️ USSD RC Fulfillment Failed',
            body: `Out of stock: ${selectedCheckerName}. Ref: ${clientReference}`,
            url: '/admin/vouchers',
        }).catch(() => {})

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

    // 8. Notify admins
    await sendPushToAdmins({
        title: '✅ USSD RC Sale',
        body: `${selectedCheckerName} sold to ${recipientPhone}. Ref: ${clientReference}`,
        url: '/admin/vouchers',
    }).catch(() => {})

    // 9. Clean up session
    await supabaseAdmin
        .from('hubtel_sessions')
        .delete()
        .eq('session_id', sessionId)

    console.log('[USSD-RC Fulfill] Successfully fulfilled order:', orderId)
    return { success: true }
}
