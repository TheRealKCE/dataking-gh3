import { NextRequest, NextResponse } from 'next/server'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function GET(request: NextRequest) {
    try {
        // Auth check — only the wallet owner (an authenticated user) may trigger verification
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore as any })
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const reference = searchParams.get('reference')
        const isInline = request.headers.get('accept')?.includes('application/json')

        if (!reference) {
            if (isInline) {
                return NextResponse.json({ success: false, error: 'No reference provided' }, { status: 400 })
            }
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=no_reference`)
        }

        const { data: paymentRecord, error: paymentLookupError } = await (supabase
            .from('wallet_payments') as any)
            .select('id, user_id, amount, total_amount, status')
            .eq('reference', reference)
            .single()

        if (paymentLookupError || !paymentRecord) {
            if (isInline) {
                return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 })
            }
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_not_found`)
        }

        if (paymentRecord.user_id !== user.id) {
            if (isInline) {
                return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
            }
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=forbidden`)
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
            if (isInline) {
                return NextResponse.json({ success: false, error: 'Payment verification failed' }, { status: 400 })
            }
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed`
            )
        }

        const expectedAmountPesewas = Math.round(Number(paymentRecord.total_amount || paymentRecord.amount) * 100)
        if (Number(paystackData.data.amount) !== expectedAmountPesewas) {
            console.error('[PaymentVerify] Paystack amount mismatch for payment record')
            if (isInline) {
                return NextResponse.json({ success: false, error: 'Payment verification failed' }, { status: 400 })
            }
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed`
            )
        }

        // Process the payment using shared utility
        const result = await processCompletedWalletPayment(reference, paystackData.data, user.id)

        if (!result.success) {
            if (isInline) {
                return NextResponse.json({ success: false, error: result.error || 'Processing failed' }, { status: 500 })
            }
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=${result.error || 'processing_failed'}`
            )
        }

        if (isInline) {
            return NextResponse.json({ success: true, message: 'Payment successful' })
        }
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?success=true`
        )
    } catch (error) {
        console.error('[PaymentVerify] Verification error:', error)
        const isInline = request.headers.get('accept')?.includes('application/json')
        if (isInline) {
            return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 })
        }
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=verification_failed`
        )
    }
}
