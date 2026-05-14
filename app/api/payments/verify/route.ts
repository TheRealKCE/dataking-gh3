import { NextRequest, NextResponse } from 'next/server'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { checkPaymentStatus } from '@/lib/moolre-payment-service'

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

        // Fast-path: Check if webhook already processed it
        if (paymentRecord.status === 'completed') {
            if (isInline) return NextResponse.json({ success: true, status: 'completed', message: 'Payment successful' })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?success=true`)
        } else if (paymentRecord.status === 'failed') {
            if (isInline) return NextResponse.json({ success: false, status: 'failed', message: 'Payment failed' }, { status: 400 })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed`)
        }

        // Verify with Moolre
        const moolreResponse = await checkPaymentStatus(reference)

        if (!moolreResponse.success || moolreResponse.txstatus === null) {
            console.error('[PaymentVerify] Moolre verification failed:', moolreResponse.error)
            // Do not fail the transaction immediately on network error, just return pending so frontend keeps polling
            if (isInline) {
                return NextResponse.json({ success: false, status: 'pending', error: 'Payment verification pending' })
            }
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet`)
        }

        if (moolreResponse.txstatus === 0 || moolreResponse.txstatus === 3) {
            // Still pending
            if (isInline) return NextResponse.json({ success: true, status: 'pending', message: 'Payment pending' })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet`)
        }

        if (moolreResponse.txstatus === 2) {
            // Failed
            await (supabase.from('wallet_payments') as any).update({ status: 'failed' }).eq('id', paymentRecord.id)
            if (isInline) return NextResponse.json({ success: false, status: 'failed', message: 'Payment failed' })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed`)
        }

        // Processing successful payment (txstatus === 1)
        // Note: processCompletedWalletPayment expects Paystack-like payload format `amount` in kobo/pesewas
        const expectedAmountPesewas = Math.round(Number(paymentRecord.total_amount || paymentRecord.amount) * 100)
        
        const eventData = {
            reference: reference,
            amount: expectedAmountPesewas,
            metadata: (paymentRecord as any).metadata || {}
        }

        const result = await processCompletedWalletPayment(reference, eventData, user.id)

        if (!result.success) {
            if (isInline) {
                return NextResponse.json({ success: false, status: 'failed', error: result.error || 'Processing failed' }, { status: 500 })
            }
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=${result.error || 'processing_failed'}`
            )
        }

        if (isInline) {
            return NextResponse.json({ success: true, status: 'completed', message: 'Payment successful' })
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
