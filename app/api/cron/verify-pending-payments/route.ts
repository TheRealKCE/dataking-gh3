import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    try {
        // Get pending payments older than 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

        const { data: payments, error } = await supabase
            .from('wallet_payments')
            .select('*')
            .eq('status', 'pending')
            .lt('created_at', fiveMinutesAgo)
            .limit(20)

        if (error) throw error

        let verified = 0
        let failed = 0

        for (const payment of payments || []) {
            try {
                // Verify with Paystack
                const response = await fetch(
                    `https://api.paystack.co/transaction/verify/${payment.reference}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                        },
                    }
                )

                const data = await response.json()

                if (data.status && data.data.status === 'success') {
                    // Payment successful - credit wallet
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

                        await supabase.from('wallet_transactions').insert({
                            wallet_id: wallet.id,
                            user_id: payment.user_id,
                            type: 'credit',
                            amount: payment.amount,
                            description: 'Wallet top-up via Paystack (verified by cron)',
                            reference: payment.reference,
                            source: 'payment',
                            status: 'completed',
                        })

                        await supabase.from('notifications').insert({
                            user_id: payment.user_id,
                            title: 'Wallet Topped Up',
                            message: `Your wallet has been credited with GHS ${payment.amount.toFixed(2)}`,
                            type: 'payment_success',
                            action_url: '/dashboard/wallet',
                        })
                    }

                    await supabase
                        .from('wallet_payments')
                        .update({
                            status: 'completed',
                            metadata: data.data,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', payment.id)

                    verified++
                } else if (data.data?.status === 'failed' || data.data?.status === 'abandoned') {
                    // Payment failed
                    await supabase
                        .from('wallet_payments')
                        .update({
                            status: 'failed',
                            metadata: data.data,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', payment.id)

                    failed++
                }
                // If still pending at Paystack, leave as-is
            } catch (paymentError) {
                console.error(`Error verifying payment ${payment.id}:`, paymentError)
            }
        }

        return NextResponse.json({
            success: true,
            processed: payments?.length || 0,
            verified,
            failed,
        })
    } catch (error) {
        console.error('Cron verify-pending-payments error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
