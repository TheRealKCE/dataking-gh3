import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { processCompletedWalletPayment, processCompletedUpgradePayment } from '@/lib/payments'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function POST(request: NextRequest) {
    try {
        const supabase = createServerClient()
        const body = await request.text()

        let event
        try {
            event = JSON.parse(body)
        } catch (e) {
            console.error('[MoolreWebhook] Failed to parse JSON body:', body)
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        console.log('[MoolreWebhook] Received event:', event)

        // Only process successful payments (txstatus: 1)
        if (event.data && String(event.data.txstatus) === '1') {
            const { externalref, value, payer } = event.data

            if (!externalref) {
                console.error('[MoolreWebhook] Missing externalref')
                return NextResponse.json({ error: 'Missing externalref' }, { status: 400 })
            }

            // Convert Moolre value (GHS) to pesewas (which the processors expect)
            const paidAmountKobo = Math.round(parseFloat(value) * 100)

            // o. SHOP ORDERS
            // Moolre doesn't send metadata back, so we fetch it from Redis
            if (externalref.startsWith('SHOP-')) {
                const metadataStr = await redis.get<string>(`shop:meta:${externalref}`)

                if (!metadataStr) {
                    console.error(`[MoolreWebhook] Metadata not found in Redis for Shop Order: ${externalref}`)
                    return NextResponse.json({ received: true })
                }

                let metadata
                try {
                    metadata = typeof metadataStr === 'string' ? JSON.parse(metadataStr) : metadataStr
                } catch (e) {
                    metadata = metadataStr
                }

                const { processShopOrder } = await import('@/lib/shop-order-processor')
                console.log('[MoolreWebhook] Routing shop order payment:', externalref)
                await processShopOrder(externalref, metadata, paidAmountKobo, metadata?.shop_slug)
                return NextResponse.json({ received: true })
            }

            // o. RC VOUCHERS: References starting with RC- are Results Checker purchases via Moolre
            if (externalref.startsWith('RC-')) {
                const { finalizeRCGatewayOrder } = await import('@/lib/vouchers/checkout')
                console.log('[MoolreWebhook] Routing RC Voucher order payment:', externalref)
                await finalizeRCGatewayOrder({ reference: externalref, paidAmountKobo })
                return NextResponse.json({ received: true })
            }

            // Get payment record from DB for Wallet Topups and Agent Upgrades
            const { data: payment } = await supabase
                .from('wallet_payments')
                .select('total_amount, status, metadata')
                .eq('reference', externalref)
                .single()

            if (!payment) {
                console.error('[MoolreWebhook] Payment not found in database:', externalref)
                return NextResponse.json({ received: true })
            }

            // Idempotency Check
            if ((payment as any).status === 'completed') {
                console.log('[MoolreWebhook] Payment already processed, ignoring duplicate')
                return NextResponse.json({ received: true })
            }

            // Route by payment type based on the externalref prefix or DB metadata
            const metadata = (payment as any).metadata || {}

            if (externalref.startsWith('agent_upgrade_') || metadata.upgrade_type === 'agent') {
                // Agent membership upgrades
                const mappedEventData = {
                    reference: externalref,
                    amount: paidAmountKobo,
                    metadata: metadata,
                }
                await processCompletedUpgradePayment(externalref, mappedEventData)
            } else {
                // Standard wallet top-up
                const mappedEventData = {
                    reference: externalref,
                    amount: paidAmountKobo,
                    metadata: metadata,
                }
                await processCompletedWalletPayment(externalref, mappedEventData)
            }
        } else {
            console.log(`[MoolreWebhook] Ignoring non-successful event. txstatus:`, event.data?.txstatus)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[MoolreWebhook] Webhook error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}
