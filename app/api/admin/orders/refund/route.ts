import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { sendOrderRefundSMS } from '@/lib/sms-service'
import { sendPushToUser } from '@/lib/web-push'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const body = await request.json()
        const { orderId } = body

        if (!orderId) {
            return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // 1. Fetch order details
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, user_id, price, reference_code, phone_number, network, status, payment_status, download_batch_id, users!inner(phone_number)')
            .eq('id', orderId)
            .single()

        if (fetchError || !order) {
            console.error('[RefundOrder] Order fetch error:', fetchError)
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // Check if order is already refunded
        if ((order as any).payment_status === 'refunded') {
            console.warn(`[RefundOrder] Order ${orderId} is already refunded`)
            return NextResponse.json({
                error: 'This order has already been refunded'
            }, { status: 400 })
        }

        const refundAmount = (order as any).price
        const userId = (order as any).user_id
        const previousStatus = (order as any).status

        // 2. Fetch the wallet row (needed for the ledger wallet_id and for the SMS balance).
        const { data: wallet, error: walletFetchError } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('user_id', userId)
            .single()

        if (walletFetchError || !wallet) {
            console.error('[RefundOrder] Wallet fetch error:', walletFetchError)
            return NextResponse.json({ error: 'User wallet not found' }, { status: 404 })
        }

        // 3. Atomically CLAIM the refund before crediting: transition paid -> refunded.
        // The .eq('payment_status', 'paid') filter makes this a compare-and-set so two
        // concurrent refunds can never both credit the wallet. Keep status='failed'
        // (a valid orders.status CHECK value) instead of the illegal status='refunded'.
        const { data: claimed, error: claimError } = await (supabase.from('orders') as any)
            .update({
                payment_status: 'refunded',
                status: 'failed',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .eq('payment_status', 'paid')
            .select('id')

        if (claimError) {
            console.error('[RefundOrder] Order claim error:', claimError)
            throw claimError
        }

        if (!claimed?.length) {
            return NextResponse.json({
                error: 'Order was already refunded by another process'
            }, { status: 409 })
        }

        // 4. Credit the wallet atomically via the shared RPC. If this fails, revert the
        // claim so the order is never left marked refunded without the money credited.
        const { error: creditError } = await (supabase as any).rpc('credit_wallet_balance', {
            p_user_id: userId,
            p_amount: refundAmount
        })

        if (creditError) {
            console.error('[RefundOrder] Wallet credit error, reverting claim:', creditError)
            await (supabase.from('orders') as any)
                .update({ payment_status: 'paid', status: previousStatus })
                .eq('id', orderId)
            return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 })
        }

        const newBalance = (wallet as any).balance + refundAmount

        // 5. Create refund ledger row (non-fatal: the money has already moved).
        const { error: transactionError } = await (supabase.from('wallet_transactions') as any).insert({
            wallet_id: (wallet as any).id,
            user_id: userId,
            type: 'credit',
            amount: refundAmount,
            description: `Refund for order ${(order as any).reference_code}`,
            reference: `REF-${(order as any).reference_code}`,
            source: 'refund',
            status: 'completed'
        })

        if (transactionError) {
            console.error('[RefundOrder] Transaction log error (non-fatal):', transactionError)
        }

        // 6. Check if order needs to be assigned to a batch
        let batchId = (order as any).download_batch_id

        if (!batchId) {
            // Create a new batch for this manually refunded order
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
            const filename = `manual_refund_${timestamp}.xlsx`

            const { data: newBatch, error: batchError } = await (supabase.from('download_batches') as any)
                .insert({
                    filename: filename,
                    order_count: 1,
                    network: (order as any).network || 'Unknown'
                })
                .select()
                .single()

            if (batchError) {
                console.error('[RefundOrder] Batch creation error:', batchError)
                // Don't fail the refund if batch creation fails, just log it
            } else {
                batchId = (newBatch as any).id
                console.log(`[RefundOrder] Created new batch ${batchId} for refunded order`)
            }
        }

        // 7. Attach the newly created batch to the order if one was made.
        // (Status/payment_status were already set atomically in the claim above.)
        if (batchId && batchId !== (order as any).download_batch_id) {
            const { error: orderUpdateError } = await (supabase.from('orders') as any)
                .update({ download_batch_id: batchId, updated_at: new Date().toISOString() })
                .eq('id', orderId)

            if (orderUpdateError) {
                console.error('[RefundOrder] Batch link error (non-fatal):', orderUpdateError)
            }
        }

        // 8. Create user notification
        const { error: notificationError } = await (supabase.from('notifications') as any).insert({
            user_id: (order as any).user_id,
            title: 'Order Refunded',
            message: `Your order ${(order as any).reference_code} has been refunded. GHS ${refundAmount.toFixed(2)} has been credited to your wallet.`,
            type: 'balance_updated',
            action_url: `/dashboard/wallet`
        })

        if (notificationError) {
            console.error('[RefundOrder] Notification error:', notificationError)
            // Don't fail the refund if notification fails
        }

        // 9. Push notification to user
        await sendPushToUser((order as any).user_id, {
            title: 'Order Refunded',
            body: `GHS ${refundAmount.toFixed(2)} refunded to your wallet for order ${(order as any).reference_code}.`,
            url: '/dashboard/wallet',
        }).catch(() => {})

        // 10. Send SMS notification
        const userPhone = (order as any).users?.phone_number
        if (userPhone) {
            sendOrderRefundSMS(
                userPhone,
                (order as any).phone_number,
                refundAmount,
                newBalance
            ).catch(err => console.error('[RefundOrder] SMS error:', err))
        }

        console.log(`[RefundOrder] Successfully refunded order ${orderId}`)

        return NextResponse.json({
            success: true,
            message: 'Order refunded successfully',
            newBalance: newBalance,
            batchCreated: !!(order as any).download_batch_id === false && batchId
        })

    } catch (error: any) {
        console.error('[RefundOrder] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
