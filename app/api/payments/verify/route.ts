import { NextRequest, NextResponse } from 'next/server'
import { processCompletedWalletPayment } from '@/lib/payments'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function GET(request: NextRequest) {
    try {
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
            console.error('[PaymentVerify] Paystack verification failed:', paystackData)
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed`
            )
        }

        // Process the payment using shared utility
        const result = await processCompletedWalletPayment(reference, paystackData.data)

        if (!result.success) {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=${result.error || 'processing_failed'}`
            )
        }

        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?success=true`
        )
    } catch (error) {
        console.error('[PaymentVerify] Verification error:', error)
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=verification_failed`
        )
    }
}
