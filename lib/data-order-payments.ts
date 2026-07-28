import { createServerClient } from './supabase'
import { generateReferenceCode } from './utils'
import { sendPushToUser, sendPushToAdmins } from './web-push'
import { triggerFulfillment } from './order-fulfillment-dispatcher'

/**
 * Settles a Direct Pay data bundle order once the gateway confirms payment.
 *
 * The order does not exist until this runs — /api/orders/gateway-init only
 * recorded a pending `wallet_payments` intent carrying the item details in
 * `metadata`. Here we claim that intent atomically, create the real `orders`
 * row(s) as already paid, and dispatch supplier fulfillment.
 *
 * The wallet is deliberately NOT touched: the money went straight to the
 * gateway, so no wallet balance change and no wallet_transactions row.
 *
 * Idempotent — safe to call from a webhook, the verify poller, and the
 * reconciliation crons for the same reference.
 */
/**
 * Reads back the orders a settled payment produced. Used when another caller
 * won the claim race, so every caller can still report what was bought.
 */
async function loadSettledOrders(supabase: any, reference: string) {
    const { data: payment } = await supabase
        .from('wallet_payments')
        .select('metadata')
        .eq('reference', reference)
        .single()

    const orderRefs: string[] = payment?.metadata?.order_refs || []
    if (orderRefs.length === 0) return []

    const { data: orders } = await supabase
        .from('orders')
        .select('id, reference_code, network, size, phone_number, price')
        .in('reference_code', orderRefs)

    return orders || []
}

export interface DataOrderSettleResult {
    success: boolean
    alreadyProcessed?: boolean
    error?: string
    orders?: {
        id: string
        reference_code: string
        network: string
        size: string
        phone_number: string
        price: number
    }[]
}

export async function processDataDirectOrder(
    reference: string,
    expectedUserId?: string
): Promise<DataOrderSettleResult> {
    const supabase = createServerClient() as any

    // 1. Load the payment intent
    const { data: payment, error: paymentError } = await supabase
        .from('wallet_payments')
        .select('*')
        .eq('reference', reference)
        .single()

    if (paymentError || !payment) {
        console.error('[DataOrderSettle] Payment not found:', reference)
        return { success: false, error: 'Payment not found' }
    }

    if (expectedUserId && payment.user_id !== expectedUserId) {
        console.error('[DataOrderSettle] Payment ownership mismatch:', reference)
        return { success: false, error: 'Forbidden' }
    }

    const metadata = payment.metadata || {}
    const items: any[] = Array.isArray(metadata.items) ? metadata.items : []

    if (items.length === 0) {
        console.error('[DataOrderSettle] No items in payment metadata:', reference)
        return { success: false, error: 'Malformed payment metadata' }
    }

    // 2. Atomic claim — only one caller may flip pending → completed.
    //    This is what stops the webhook and the poller double-fulfilling.
    const { data: claimed, error: claimError } = await supabase
        .from('wallet_payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)
        .eq('status', 'pending')
        .select()
        .single()

    if (claimError) {
        if (claimError.code === 'PGRST116') {
            return { success: true, alreadyProcessed: true, orders: await loadSettledOrders(supabase, reference) }
        }
        console.error('[DataOrderSettle] Claim error:', claimError)
        return { success: false, error: 'Failed to update payment status' }
    }

    if (!claimed) {
        return { success: true, alreadyProcessed: true, orders: await loadSettledOrders(supabase, reference) }
    }

    // 3. Create the orders — already paid, awaiting fulfillment
    const orderInserts = items.map((item: any) => ({
        user_id: payment.user_id,
        phone_number: item.phone_number,
        network: item.network,
        size: item.size,
        price: item.price,
        cost_price_at_time: item.cost_price || 0,
        role_at_time: item.role_at_time || metadata.role || 'customer',
        status: 'pending',
        payment_status: 'paid',
        reference_code: generateReferenceCode(),
        fulfillment_method: 'auto',
        source: 'web',
    }))

    const { data: createdOrders, error: orderError } = await supabase
        .from('orders')
        .insert(orderInserts)
        .select()

    if (orderError || !createdOrders || createdOrders.length === 0) {
        // Money has already been taken — it must land somewhere. Fall back to
        // crediting the wallet so the user is never left short.
        console.error('[DataOrderSettle] CRITICAL: order insert failed after payment:', reference, orderError)

        const { error: refundError } = await supabase.rpc('credit_wallet_balance', {
            p_user_id: payment.user_id,
            p_amount: payment.amount,
        })

        if (refundError) {
            console.error('[DataOrderSettle] CRITICAL: fallback wallet credit also failed:', refundError)
        } else {
            await supabase.from('wallet_transactions').insert({
                wallet_id: payment.wallet_id,
                user_id: payment.user_id,
                type: 'credit',
                amount: payment.amount,
                description: 'Data order could not be created — amount credited to wallet',
                reference,
                source: 'refund',
                status: 'completed',
            }).then(() => {}).catch(() => {})
        }

        await supabase
            .from('wallet_payments')
            .update({
                metadata: {
                    ...metadata,
                    settlement_error: orderError?.message || 'order insert failed',
                    settlement_fallback: refundError ? 'wallet_credit_failed' : 'credited_to_wallet',
                },
            })
            .eq('id', payment.id)

        await sendPushToAdmins({
            title: '⚠️ Data order settlement failed',
            body: `Payment ${reference} confirmed but the order could not be created. ${refundError ? 'WALLET CREDIT ALSO FAILED — manual action required.' : 'Amount credited to the user wallet.'}`,
            url: '/admin/finance',
        }).catch(() => {})

        return { success: false, error: 'Failed to create order' }
    }

    // 4. Link the created orders back to the payment so a later poll (or the
    //    fast-path in /api/payments/verify) can report exactly what was bought.
    await supabase
        .from('wallet_payments')
        .update({
            metadata: {
                ...metadata,
                order_refs: createdOrders.map((o: any) => o.reference_code),
            },
        })
        .eq('id', payment.id)

    // 5. Notify the buyer
    const totalPaid = Number(payment.total_amount ?? payment.amount)
    const summary = createdOrders.length === 1
        ? `${createdOrders[0].size} to ${createdOrders[0].phone_number}`
        : `${createdOrders.length} bundles`

    await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: 'Payment Received',
        message: `Payment of GHS ${totalPaid.toFixed(2)} confirmed. Your order for ${summary} is being processed.`,
        type: 'order_update',
        action_url: '/dashboard/my-orders',
    }).then(() => {}).catch((e: any) => console.error('[DataOrderSettle] Notification error:', e))

    await sendPushToUser(payment.user_id, {
        title: 'Payment Received',
        body: `Your order for ${summary} is being processed.`,
        url: '/dashboard/my-orders',
    }).catch((e: any) => console.error('[DataOrderSettle] Push error:', e))

    // 6. Fulfillment + supplier/admin alerts
    try {
        const { data: userData } = await supabase
            .from('users')
            .select('email, first_name, last_name, phone_number, role')
            .eq('id', payment.user_id)
            .single()

        const firstName = (userData as any)?.first_name || 'Customer'
        const userEmail = (userData as any)?.email || 'Unknown'
        const customerName = `${firstName} ${(userData as any)?.last_name || ''}`.trim() || 'Customer'

        await sendPushToAdmins({
            title: 'New Data Order (Direct Pay)',
            body: `${firstName} · ${summary} (GHS ${totalPaid.toFixed(2)})`,
            url: '/admin/orders',
        }).catch(() => {})

        for (const order of createdOrders) {
            // EXPRESS MTN is always manual — alert admin instead of auto-fulfilling
            if ((order as any).network === 'EXPRESS MTN') {
                const { sendAdminNewOrderAlert } = await import('./email-service')
                await sendAdminNewOrderAlert({
                    referenceCode: (order as any).reference_code,
                    phoneNumber: (order as any).phone_number,
                    network: (order as any).network,
                    size: (order as any).size,
                    price: (order as any).price,
                    customerName,
                    customerEmail: userEmail,
                    source: 'main_site' as const,
                    reason: 'EXPRESS MTN — Manual fulfillment required',
                }).catch(err => console.error('[DataOrderSettle] EXPRESS MTN admin alert failed:', err))
                continue
            }

            await triggerFulfillment((order as any).id, (order as any).network, {
                email: userEmail,
                name: customerName,
            })
        }
    } catch (postError) {
        console.error('[DataOrderSettle] Post-settlement fulfillment failed:', postError)
    }

    return {
        success: true,
        orders: createdOrders.map((o: any) => ({
            id: o.id,
            reference_code: o.reference_code,
            network: o.network,
            size: o.size,
            phone_number: o.phone_number,
            price: o.price,
        })),
    }
}
