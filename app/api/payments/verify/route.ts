import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function GET(request: NextRequest) {
    try {
        const supabase = createServerClient()
        const { searchParams } = new URL(request.url)
        const reference = searchParams.get('reference')

        if (!reference) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=no_reference`)
        }

        // Verify with Paystack
        const paystackResponse = await fetch(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                },
            }
        )

        const paystackData = await paystackResponse.json()

        if (!paystackData.status || paystackData.data.status !== 'success') {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed`
            )
        }

        // Get payment record
        const { data: payment, error: paymentError } = await supabase
            .from('wallet_payments')
            .select('*')
            .eq('reference', reference)
            .single()

        if (paymentError || !payment) {
            console.error('Payment not found:', paymentError)
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_not_found`
            )
        }

        // Check if already processed (idempotency)
        if (payment.status === 'completed') {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?success=true`
            )
        }

        // Update payment status
        await supabase
            .from('wallet_payments')
            .update({
                status: 'completed',
                metadata: paystackData.data,
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

        // Create transaction record
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

        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?success=true`
        )
    } catch (error) {
        console.error('Payment verification error:', error)
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=verification_failed`
        )
    }
}
