import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { processCompletedWalletPayment } from '@/lib/payments'

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
                    `https://api.paystack.co/transaction/verify/${(payment as any).reference}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                        },
                    }
                )

                const data = await response.json()

                if (data.status && data.data.status === 'success') {
                    // Process the payment using shared utility
                    const result = await processCompletedWalletPayment((payment as any).reference, data.data)
                    if (result.success) {
                        verified++
                    }
                } else if (data.data?.status === 'failed' || data.data?.status === 'abandoned') {
                    // Payment failed
                    await (supabase
                        .from('wallet_payments') as any)
                        .update({
                            status: 'failed',
                            metadata: data.data,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', (payment as any).id)

                    failed++
                }
                // If still pending at Paystack, leave as-is
            } catch (paymentError) {
                console.error(`Error verifying payment ${(payment as any).id}:`, paymentError)
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
