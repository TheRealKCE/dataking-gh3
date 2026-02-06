import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendOrderRefundSMS } from '@/lib/sms-service'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
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
            .select('id, user_id, price, reference_code, phone_number, download_batch_id, users!inner(phone_number)')
            .eq('id', orderId)
            .single()

        if (fetchError || !order) {
            console.error('[RefundOrder] Order fetch error:', fetchError)
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // 2. Fetch user wallet
        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', (order as any).user_id)
            .single()

        if (walletError || !wallet) {
            console.error('[RefundOrder] Wallet fetch error:', walletError)
            return NextResponse.json({ error: 'User wallet not found' }, { status: 404 })
        }

        const refundAmount = (order as any).price
        const newBalance = (wallet as any).balance + refundAmount

        // 3. Update wallet balance
        const { error: walletUpdateError } = await (supabase.from('wallets') as any)
            .update({
                balance: newBalance,
                total_spent: (wallet as any).total_spent - refundAmount
            })
            .eq('id', (wallet as any).id)

        if (walletUpdateError) {
            console.error('[RefundOrder] Wallet update error:', walletUpdateError)
            throw walletUpdateError
        }

        // 4. Create refund transaction
        const { error: transactionError } = await (supabase.from('wallet_transactions') as any).insert({
            wallet_id: (wallet as any).id,
            user_id: (order as any).user_id,
            type: 'credit',
            amount: refundAmount,
            description: `Refund for order ${(order as any).reference_code}`,
            reference: `REF-${(order as any).reference_code}`,
            source: 'refund',
            status: 'completed'
        })

        if (transactionError) {
            console.error('[RefundOrder] Transaction creation error:', transactionError)
            throw transactionError
        }

        // 5. Check if order needs to be assigned to a batch
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

        // 6. Update order status
        const orderUpdate: any = {
            payment_status: 'refunded',
            status: 'failed',
            updated_at: new Date().toISOString()
        }

        if (batchId) {
            orderUpdate.download_batch_id = batchId
        }

        const { error: orderUpdateError } = await (supabase.from('orders') as any)
            .update(orderUpdate)
            .eq('id', orderId)

        if (orderUpdateError) {
            console.error('[RefundOrder] Order update error:', orderUpdateError)
            throw orderUpdateError
        }

        // 7. Create user notification
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

        // 8. Send SMS notification
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
