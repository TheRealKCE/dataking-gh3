import { NextRequest, NextResponse } from 'next/server'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { checkPaymentStatus } from '@/lib/moolre-payment-service'
import { checkPaymentStatus as hubtelCheckPaymentStatus } from '@/lib/hubtel-payment-service'

export async function GET(request: NextRequest) {
    try {
        // Auth check — only the wallet owner (an authenticated user) may trigger verification
        const cookieStore = await cookies()
        const supabase = await createRouteHandlerClient()
        let { data: { user }, error: authError } = await supabase.auth.getUser()

        // Fallback for classifieds that sends token in Authorization header
        if (!user) {
            const authHeader = request.headers.get('authorization')
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7)
                const { data: jwtUser } = await supabase.auth.getUser(token)
                if (jwtUser?.user) {
                    user = jwtUser.user
                    authError = null
                }
            }
        }

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
            .select('id, user_id, amount, total_amount, status, provider, metadata, created_at')
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
            // Direct-pay data orders: return what was actually bought. The webhook
            // usually settles before the first poll, so this is the normal path.
            if (reference.startsWith('DATA-')) {
                const orderRefs: string[] = (paymentRecord as any).metadata?.order_refs || []
                let placedOrders: any[] = []
                if (orderRefs.length > 0) {
                    const { data: orderRows } = await (supabase.from('orders') as any)
                        .select('id, reference_code, network, size, phone_number, price')
                        .in('reference_code', orderRefs)
                    placedOrders = orderRows || []
                }
                if (isInline) return NextResponse.json({ success: true, status: 'completed', message: 'Payment successful', orders: placedOrders })
                return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/data-packages?success=true`)
            }
            if (isInline) return NextResponse.json({ success: true, status: 'completed', message: 'Payment successful' })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?success=true`)
        } else if (paymentRecord.status === 'failed') {
            if (isInline) return NextResponse.json({ success: false, status: 'failed', message: 'Payment failed' }, { status: 400 })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed`)
        }

        // For Paystack payments: webhook handles completion; just return pending so frontend keeps polling
        if ((paymentRecord as any).provider === 'paystack') {
            if (isInline) return NextResponse.json({ success: true, status: 'pending', message: 'Waiting for payment confirmation...' })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet`)
        }

        // ── Hubtel status check ───────────────────────────────────────────────
        if ((paymentRecord as any).provider === 'hubtel') {
            // The client polls this endpoint every 3 seconds. Hubtel's status API is
            // reached through a metered static-IP proxy, so calling it on every poll
            // burned roughly 20 proxy requests per payment and exhausted the monthly
            // quota after ~25 top-ups — which then broke payments outright with a 407.
            //
            // Hubtel confirms via webhook, and the DB fast-path above already catches
            // that. So treat the status API as a FALLBACK for when the webhook does not
            // arrive: stay quiet for a grace period, then poll it at a slow interval.
            const now = Date.now()
            const createdAt = new Date((paymentRecord as any).created_at).getTime()
            const meta = ((paymentRecord as any).metadata || {}) as Record<string, any>
            const lastCheck = meta.last_hubtel_check ? new Date(meta.last_hubtel_check).getTime() : 0

            const WEBHOOK_GRACE_MS = 45_000   // give the callback time to land
            const MIN_CHECK_INTERVAL_MS = 20_000

            const tooEarly = Number.isFinite(createdAt) && (now - createdAt) < WEBHOOK_GRACE_MS
            const tooSoon = (now - lastCheck) < MIN_CHECK_INTERVAL_MS

            if (tooEarly || tooSoon) {
                if (isInline) return NextResponse.json({ success: true, status: 'pending', message: 'Waiting for payment confirmation...' })
                return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet`)
            }

            // Stamp before the call so concurrent polls don't all queue up behind it.
            await (supabase.from('wallet_payments') as any)
                .update({ metadata: { ...meta, last_hubtel_check: new Date(now).toISOString() } })
                .eq('id', (paymentRecord as any).id)

            const hubtelResponse = await hubtelCheckPaymentStatus(reference)

            if (!hubtelResponse.success || hubtelResponse.status === null) {
                console.error('[PaymentVerify] Hubtel verification failed:', hubtelResponse.error)
                if (isInline) return NextResponse.json({ success: false, status: 'pending', error: 'Payment verification pending' })
                return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet`)
            }

            if (hubtelResponse.status === 'Unpaid') {
                if (isInline) return NextResponse.json({ success: true, status: 'pending', message: 'Payment pending' })
                return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet`)
            }

            if (hubtelResponse.status === 'Refunded' || (hubtelResponse.status !== 'Paid')) {
                // Any status other than 'Paid' is treated as failed
                await (supabase.from('wallet_payments') as any).update({ status: 'failed' }).eq('id', paymentRecord.id)
                if (isInline) return NextResponse.json({ success: false, status: 'failed', message: 'Payment failed or refunded' })
                return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed`)
            }

            // hubtelResponse.status === 'Paid' — settle direct-pay data orders here.
            // The generic path below queries Moolre, which cannot verify a Hubtel
            // reference, so a DATA- order must be settled before we reach it.
            if (reference.startsWith('DATA-')) {
                const { processDataDirectOrder } = await import('@/lib/data-order-payments')
                const result = await processDataDirectOrder(reference, user.id)
                if (!result.success) {
                    if (isInline) return NextResponse.json({ success: false, status: 'failed', error: result.error || 'Order processing failed' }, { status: 500 })
                    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/data-packages?error=order_failed`)
                }
                if (isInline) return NextResponse.json({ success: true, status: 'completed', message: 'Payment successful', orders: result.orders || [] })
                return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/data-packages?success=true`)
            }

            // fall through to process payment below
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
        // For DATA- references, delegate to the data order processor. Without this
        // the payment would fall through below and CREDIT THE WALLET instead of
        // creating and fulfilling the data bundle order.
        if (reference.startsWith('DATA-')) {
            const { processDataDirectOrder } = await import('@/lib/data-order-payments')
            const result = await processDataDirectOrder(reference, user.id)
            if (!result.success) {
                if (isInline) return NextResponse.json({ success: false, status: 'failed', error: result.error || 'Order processing failed' }, { status: 500 })
                return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/data-packages?error=order_failed`)
            }
            if (isInline) return NextResponse.json({ success: true, status: 'completed', message: 'Payment successful', orders: (result as any).orders })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/data-packages?success=true`)
        }

        // For BOOST- references, delegate to the boost processor
        if (reference.startsWith('BOOST-')) {
            const { processBoostPayment } = await import('@/lib/classifieds-payments')
            const result = await processBoostPayment(reference)
            if (!result.success && !result.alreadyProcessed) {
                if (isInline) return NextResponse.json({ success: false, status: 'failed', error: result.error || 'Boost processing failed' }, { status: 500 })
                return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/classifieds/seller/dashboard?boost_error=true`)
            }
            if (isInline) return NextResponse.json({ success: true, status: 'completed', message: 'Boost activated!' })
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/classifieds/seller/dashboard?boost_success=true`)
        }

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
