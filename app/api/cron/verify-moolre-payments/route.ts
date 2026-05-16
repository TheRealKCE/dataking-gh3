import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkPaymentStatus } from '@/lib/moolre-payment-service'
import { processCompletedWalletPayment, processCompletedUpgradePayment } from '@/lib/payments'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const results = {
        walletChecked: 0,
        walletCredited: 0,
        walletFailed: 0,
        shopChecked: 0,
        shopProcessed: 0,
        shopFailed: 0,
        errors: [] as string[],
    }

    // ── Part A: Pending Wallet Top-ups & Upgrades ─────────────────────────
    try {
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()

        const { data: pendingPayments, error: fetchError } = await (supabase
            .from('wallet_payments') as any)
            .select('id, reference, total_amount, amount, status, metadata, user_id')
            .eq('status', 'pending')
            .lt('created_at', threeMinutesAgo)
            .limit(10)

        if (fetchError) {
            console.error('[CronMoolre] wallet_payments query error:', fetchError)
            results.errors.push(`wallet_payments query: ${fetchError.message}`)
        } else {
            for (const payment of pendingPayments || []) {
                results.walletChecked++
                try {
                    const statusResult = await checkPaymentStatus(payment.reference)

                    if (!statusResult.success || statusResult.txstatus === null) {
                        // Can't determine status — skip, try next run
                        continue
                    }

                    if (statusResult.txstatus === 1) {
                        // ✅ Payment successful — process it
                        const paidAmountPesewas = Math.round(
                            Number(payment.total_amount || payment.amount) * 100
                        )
                        const metadata = payment.metadata || {}
                        const mappedEventData = {
                            reference: payment.reference,
                            amount: paidAmountPesewas,
                            metadata,
                        }

                        if (
                            payment.reference.startsWith('agent_upgrade_') ||
                            metadata.upgrade_type === 'agent'
                        ) {
                            await processCompletedUpgradePayment(payment.reference, mappedEventData)
                        } else {
                            await processCompletedWalletPayment(
                                payment.reference,
                                mappedEventData,
                                payment.user_id
                            )
                        }

                        results.walletCredited++
                        console.log(`[CronMoolre] ✅ Wallet payment ${payment.reference} credited`)
                    } else if (statusResult.txstatus === 2) {
                        // ❌ Payment explicitly failed
                        await (supabase.from('wallet_payments') as any)
                            .update({ status: 'failed', updated_at: new Date().toISOString() })
                            .eq('id', payment.id)
                        results.walletFailed++
                        console.log(`[CronMoolre] ❌ Wallet payment ${payment.reference} failed`)
                    }
                    // txstatus 0 or 3 = still pending, leave as-is
                } catch (err: any) {
                    console.error(`[CronMoolre] Wallet error for ${payment.id}:`, err)
                    results.errors.push(`wallet ${payment.id}: ${err.message}`)
                }
            }
        }
    } catch (partAErr: any) {
        console.error('[CronMoolre] Part A (wallet) failed:', partAErr)
        results.errors.push(`Part A: ${partAErr.message}`)
    }

    // ── Part B: Shop Orders stuck in Redis ─────────────────────────────────
    try {
        let cursor = 0
        const shopKeys: string[] = []

        // Scan Redis for shop:meta:* keys (max 15 to prevent timeout)
        do {
            const [nextCursor, keys] = await redis.scan(cursor, {
                match: 'shop:meta:*',
                count: 15,
            })
            cursor = typeof nextCursor === 'string' ? parseInt(nextCursor) : nextCursor
            shopKeys.push(...keys)
            if (shopKeys.length >= 15) break
        } while (cursor !== 0)

        for (const key of shopKeys) {
            results.shopChecked++
            try {
                const reference = key.replace('shop:meta:', '')

                // Check if this order was already processed in shop_orders
                const { data: existingOrder } = await (supabase
                    .from('shop_orders') as any)
                    .select('id')
                    .eq('reference', reference)
                    .maybeSingle()

                if (existingOrder) {
                    // Already processed — clean up Redis key
                    await redis.del(key)
                    continue
                }

                // Check Moolre payment status
                const statusResult = await checkPaymentStatus(reference)

                if (!statusResult.success || statusResult.txstatus === null) {
                    continue // Can't determine, try next run
                }

                if (statusResult.txstatus === 1) {
                    // ✅ Payment was successful but order was never created
                    const metadataStr = await redis.get<string>(key)
                    if (!metadataStr) continue

                    let metadata: any
                    try {
                        metadata = typeof metadataStr === 'string'
                            ? JSON.parse(metadataStr)
                            : metadataStr
                    } catch {
                        metadata = metadataStr
                    }

                    // Calculate paid amount from metadata
                    const sellingPrice = parseFloat(metadata.selling_price || '0')
                    const paystackFee = parseFloat(metadata.paystack_fee || '0')
                    const feeAmount = parseFloat(metadata.fee_amount || '0')
                    const totalGHS = sellingPrice + paystackFee + feeAmount
                    const paidAmountPesewas = Math.round(totalGHS * 100)

                    const { processShopOrder } = await import('@/lib/shop-order-processor')
                    console.log(`[CronMoolre] Processing missed shop order: ${reference}`)
                    await processShopOrder(
                        reference,
                        metadata,
                        paidAmountPesewas,
                        metadata?.shop_slug
                    )

                    results.shopProcessed++
                } else if (statusResult.txstatus === 2) {
                    // ❌ Payment failed — clean up Redis
                    await redis.del(key)
                    results.shopFailed++
                }
                // txstatus 0 or 3 = still pending
            } catch (err: any) {
                console.error(`[CronMoolre] Shop error for key ${key}:`, err)
                results.errors.push(`shop ${key}: ${err.message}`)
            }
        }
    } catch (partBErr: any) {
        console.error('[CronMoolre] Part B (shop) failed:', partBErr)
        results.errors.push(`Part B: ${partBErr.message}`)
    }

    console.log('[CronMoolre] Run complete:', results)
    return NextResponse.json({ success: true, ...results })
}
