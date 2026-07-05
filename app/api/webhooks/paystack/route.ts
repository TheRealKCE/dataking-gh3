import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { processCompletedWalletPayment } from '@/lib/payments'
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
            console.error('[PaystackWebhook] Invalid webhook signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const event = JSON.parse(body)

        if (event.event === 'charge.success') {
            const { reference, amount: paidAmountKobo } = event.data
            const metadata = event.data.metadata

            // o. SHOP ORDERS: References starting with SHOP- are storefront guest orders.
            // They are NOT stored in wallet_payments, so we must handle them separately
            // before the DB lookup to avoid "Payment not found" errors.
            if (reference && reference.startsWith('SHOP-')) {
                const { processShopOrder } = await import('@/lib/shop-order-processor')
                console.log('[PaystackWebhook] Routing shop order payment')
                await processShopOrder(reference, metadata, paidAmountKobo, metadata?.slug)
                return NextResponse.json({ received: true })
            }

            // o. RC VOUCHERS: References starting with RC- are voucher purchases
            if (reference && reference.startsWith('RC-')) {
                const { finalizeRCGatewayOrder } = await import('@/lib/vouchers/checkout')
                console.log('[PaystackWebhook] Routing RC Voucher order payment')
                await finalizeRCGatewayOrder({ reference, paidAmountKobo, metadata })
                return NextResponse.json({ received: true })
            }

            // Get payment record for verification
            const { data: payment } = await supabase
                .from('wallet_payments')
                .select('total_amount, status')
                .eq('reference', reference)
                .single()

            if (!payment) {
                console.error('[PaystackWebhook] Payment not found:', reference)
                return NextResponse.json({ received: true })
            }

            // o. IDEMPOTENCY CHECK: Prevent duplicate webhook processing for ALL payment types
            // This guard covers both wallet top-ups and agent upgrades.
            // Paystack guarantees at-least-once delivery, so this is critical.
            if ((payment as any).status === 'completed') {
                console.log('[PaystackWebhook] Payment already processed, ignoring duplicate webhook')
                return NextResponse.json({ received: true })
            }

            // o. AMOUNT VERIFICATION: Cross-check paid amount against DB-stored expected amount
            const expectedAmountKobo = Math.round((payment as any).total_amount * 100)
            if (paidAmountKobo !== expectedAmountKobo) {
                console.error(`[PaystackWebhook] AMOUNT MISMATCH: Expected ${expectedAmountKobo}, got ${paidAmountKobo}`)
                return NextResponse.json({ received: true })
            }

            // o. BOOST PAYMENTS: References starting with BOOST- are classified listing boosts
            if (reference && reference.startsWith('BOOST-')) {
                const { processBoostPayment } = await import('@/lib/classifieds-payments')
                console.log('[PaystackWebhook] Routing listing boost payment:', reference)
                const boostResult = await processBoostPayment(reference, event.data)

                if (!boostResult.success && !boostResult.alreadyProcessed) {
                    console.error('[PaystackWebhook] Boost processing failed:', boostResult.error)
                    return NextResponse.json({ error: boostResult.error }, { status: 500 })
                }
                return NextResponse.json({ received: true })
            }

            // Route by payment type based on metadata
            if (reference.startsWith('agent_upgrade_') || metadata?.upgrade_type === 'agent') {
                // Agent membership upgrades
                const { processCompletedUpgradePayment } = await import('@/lib/payments')
                await processCompletedUpgradePayment(reference, event.data)
            } else {
                // Standard wallet top-up
                await processCompletedWalletPayment(reference, event.data)
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[PaystackWebhook] Webhook error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}
