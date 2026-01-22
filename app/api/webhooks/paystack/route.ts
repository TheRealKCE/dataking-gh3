import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import crypto from 'crypto'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function POST(request: NextRequest) {
    try {
        const supabase = createServerClient()

        // Verify webhook signature
        const signature = request.headers.get('x-paystack-signature')
        const body = await request.text()

        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(body)
            .digest('hex')

        if (hash !== signature) {
            console.error('Invalid webhook signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const event = JSON.parse(body)

        if (event.event === 'charge.success') {
            const { reference, amount, metadata } = event.data

            // Get payment record
            const { data: payment } = await supabase
                .from('wallet_payments')
                .select('*')
                .eq('reference', reference)
                .single()

            if (!payment) {
                console.error('Payment not found for webhook:', reference)
                return NextResponse.json({ received: true })
            }

            // Check idempotency
            if (payment.status === 'completed') {
                return NextResponse.json({ received: true })
            }

            // Update payment
            await supabase
                .from('wallet_payments')
                .update({
                    status: 'completed',
                    metadata: event.data,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id)

            // Credit wallet
            const { data: wallet } = await supabase
                .from('wallets')
                .select('*')
                .eq('id', payment.wallet_id)
                .single()

            if (wallet) {
                await supabase
                    .from('wallets')
                    .update({
                        balance: wallet.balance + payment.amount,
                        total_credited: wallet.total_credited + payment.amount,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', wallet.id)
            }

            // Create transaction
            await supabase.from('wallet_transactions').insert({
                wallet_id: payment.wallet_id,
                user_id: payment.user_id,
                type: 'credit',
                amount: payment.amount,
                description: 'Wallet top-up via Paystack',
                reference: reference,
                source: 'payment',
                status: 'completed',
            })

            // Create notification
            await supabase.from('notifications').insert({
                user_id: payment.user_id,
                title: 'Wallet Topped Up',
                message: `Your wallet has been credited with GHS ${payment.amount.toFixed(2)}`,
                type: 'payment_success',
                action_url: '/dashboard/wallet',
            })
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}
