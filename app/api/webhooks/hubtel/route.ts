import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { processCompletedWalletPayment, processCompletedUpgradePayment } from '@/lib/payments'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

/**
 * Hubtel Receive Money Callback Handler
 *
 * Hubtel sends a POST to this URL with the final transaction status.
 * ResponseCode '0000' = success, '2001' = failed.
 *
 * For extra security, whitelist Hubtel's callback IP: 18.202.122.131
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createServerClient()
        const body = await request.text()

        let event: any
        try {
            event = JSON.parse(body)
        } catch (e) {
            console.error('[HubtelWebhook] Failed to parse JSON body:', body)
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        console.log('[HubtelWebhook] Received callback:', JSON.stringify(event))

        // Only process successful payments — ResponseCode '0000'
        if (event.ResponseCode !== '0000') {
            console.log(`[HubtelWebhook] Ignoring non-successful callback. ResponseCode: ${event.ResponseCode}, Message: ${event.Message}`)
            return NextResponse.json({ received: true })
        }

        const { ClientReference, AmountCharged } = event.Data || {}

        if (!ClientReference) {
            console.error('[HubtelWebhook] Missing ClientReference in callback data')
            return NextResponse.json({ error: 'Missing ClientReference' }, { status: 400 })
        }

        // Hubtel sends amounts in GHS — convert to pesewas for our processors
        const paidAmountKobo = Math.round(parseFloat(String(AmountCharged || 0)) * 100)

        // ── SHOP ORDERS ──────────────────────────────────────────────────────────
        if (ClientReference.startsWith('SHOP-')) {
            const metadataStr = await redis.get<string>(`shop:meta:${ClientReference}`)

            if (!metadataStr) {
                console.error(`[HubtelWebhook] Metadata not found in Redis for Shop Order: ${ClientReference}`)
                return NextResponse.json({ received: true })
            }

            let metadata
            try {
                metadata = typeof metadataStr === 'string' ? JSON.parse(metadataStr) : metadataStr
            } catch (e) {
                metadata = metadataStr
            }

            const { processShopOrder } = await import('@/lib/shop-order-processor')
            console.log('[HubtelWebhook] Routing shop order payment:', ClientReference)
            await processShopOrder(ClientReference, metadata, paidAmountKobo, metadata?.shop_slug)
            return NextResponse.json({ received: true })
        }

        // ── RESULTS CHECKER VOUCHERS ─────────────────────────────────────────────
        if (ClientReference.startsWith('RC-')) {
            const { finalizeRCGatewayOrder } = await import('@/lib/vouchers/checkout')
            console.log('[HubtelWebhook] Routing RC Voucher order payment:', ClientReference)
            await finalizeRCGatewayOrder({ reference: ClientReference, paidAmountKobo })
            return NextResponse.json({ received: true })
        }

        // NOTE: USSD result-checker payments are NOT handled here. They run on
        // Hubtel's Programmable Services API, which delivers payment via the
        // Service Fulfilment callback at /api/hubtel/fulfill — not this
        // Receive-Money webhook.

        // For Wallet Top-ups, Agent Upgrades, and Classifieds Boosts — look up via wallet_payments
        const { data: payment } = await supabase
            .from('wallet_payments')
            .select('total_amount, status, metadata')
            .eq('reference', ClientReference)
            .single()

        if (!payment) {
            console.error('[HubtelWebhook] Payment not found in database:', ClientReference)
            return NextResponse.json({ received: true })
        }

        // Idempotency — ignore if already processed
        if ((payment as any).status === 'completed') {
            console.log('[HubtelWebhook] Payment already processed, ignoring duplicate callback')
            return NextResponse.json({ received: true })
        }

        // Amount verification
        const expectedAmountPesewas = Math.round((payment as any).total_amount * 100)
        if (paidAmountKobo !== expectedAmountPesewas) {
            console.error(
                `[HubtelWebhook] AMOUNT MISMATCH for ${ClientReference}: Expected ${expectedAmountPesewas} pesewas, got ${paidAmountKobo} pesewas`
            )
            return NextResponse.json({ received: true })
        }

        // ── CLASSIFIEDS BOOST ─────────────────────────────────────────────────────
        if (ClientReference.startsWith('BOOST-')) {
            const { processBoostPayment } = await import('@/lib/classifieds-payments')
            console.log('[HubtelWebhook] Routing listing boost payment:', ClientReference)
            const boostResult = await processBoostPayment(ClientReference, {
                reference: ClientReference,
                amount: paidAmountKobo,
            })

            if (!boostResult.success && !boostResult.alreadyProcessed) {
                console.error('[HubtelWebhook] Boost processing failed:', boostResult.error)
                return NextResponse.json({ error: boostResult.error }, { status: 500 })
            }
            return NextResponse.json({ received: true })
        }

        // Route by type using reference prefix or metadata
        const metadata = (payment as any).metadata || {}
        const mappedEventData = {
            reference: ClientReference,
            amount: paidAmountKobo,
            metadata,
        }

        if (ClientReference.startsWith('agent_upgrade_') || metadata.upgrade_type === 'agent') {
            // ── AGENT UPGRADE ─────────────────────────────────────────────────────
            console.log('[HubtelWebhook] Routing agent upgrade payment:', ClientReference)
            await processCompletedUpgradePayment(ClientReference, mappedEventData)
        } else {
            // ── WALLET TOP-UP ─────────────────────────────────────────────────────
            console.log('[HubtelWebhook] Routing wallet top-up payment:', ClientReference)
            await processCompletedWalletPayment(ClientReference, mappedEventData)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[HubtelWebhook] Webhook processing error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}
