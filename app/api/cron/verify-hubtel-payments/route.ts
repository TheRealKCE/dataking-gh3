import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkPaymentStatus } from '@/lib/hubtel-payment-service'
import { processCompletedWalletPayment, processCompletedUpgradePayment, processCompletedDealerSubscription } from '@/lib/payments'

/**
 * Reconciles Hubtel payments whose callback never arrived.
 *
 * Hubtel confirms mobile money transactions asynchronously via PrimaryCallbackUrl.
 * If that callback is lost (network blip, deploy, wrong NEXT_PUBLIC_APP_URL), the
 * payment sits `pending` forever: the customer is debited but never credited or
 * upgraded. This sweep catches those.
 *
 * Deliberately not gated on CRON_JOBS_ENABLED — this is financial reconciliation,
 * and a missing env var silently disabling it would recreate the gap it closes.
 */

// Hubtel advises against status-checking before the callback window has elapsed.
const CALLBACK_GRACE_MINUTES = 5
// Only give up on a payment well after any prompt could still be approved.
const FAILURE_CUTOFF_MINUTES = 60

export async function GET(request: NextRequest) {
    const startTime = Date.now()

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const results = {
        checked: 0,
        credited: 0,
        failed: 0,
        stillPending: 0,
        errors: [] as string[],
        totalTimeMs: 0,
    }

    try {
        const graceCutoff = new Date(Date.now() - CALLBACK_GRACE_MINUTES * 60 * 1000).toISOString()
        const failureCutoff = new Date(Date.now() - FAILURE_CUTOFF_MINUTES * 60 * 1000)

        const { data: pendingPayments, error: fetchError } = await (supabase
            .from('wallet_payments') as any)
            .select('id, reference, total_amount, amount, status, metadata, user_id, created_at')
            .eq('status', 'pending')
            .eq('provider', 'hubtel')
            .lt('created_at', graceCutoff)
            .limit(10)

        if (fetchError) {
            console.error('[CronHubtel] wallet_payments query error:', fetchError)
            results.errors.push(`wallet_payments query: ${fetchError.message}`)
        } else if (pendingPayments && pendingPayments.length > 0) {
            const checkPromises = pendingPayments.map(async (payment: any) => {
                results.checked++
                try {
                    const statusResult = await checkPaymentStatus(payment.reference)

                    if (!statusResult.success || statusResult.status === null) {
                        results.stillPending++
                        return // Can't determine status — retry next run
                    }

                    if (statusResult.status === 'Paid') {
                        const paidAmountPesewas = Math.round(
                            Number(payment.total_amount || payment.amount) * 100
                        )
                        const metadata = payment.metadata || {}
                        const mappedEventData = {
                            reference: payment.reference,
                            amount: paidAmountPesewas,
                            metadata,
                        }

                        if (payment.reference.startsWith('BOOST-')) {
                            const { processBoostPayment } = await import('@/lib/classifieds-payments')
                            const boostResult = await processBoostPayment(payment.reference, mappedEventData)
                            if (!boostResult.success && !boostResult.alreadyProcessed) {
                                throw new Error(boostResult.error || 'Boost processing failed')
                            }
                            console.log(`[CronHubtel] ✅ Boost payment ${payment.reference} credited`)
                        } else if (
                            payment.reference.startsWith('agent_upgrade_') ||
                            metadata.upgrade_type === 'agent'
                        ) {
                            await processCompletedUpgradePayment(payment.reference, mappedEventData)
                            console.log(`[CronHubtel] ✅ Agent upgrade ${payment.reference} credited`)
                        } else if (
                            payment.reference.startsWith('dealer_sub_') ||
                            metadata.upgrade_type === 'dealer_subscription'
                        ) {
                            await processCompletedDealerSubscription(payment.reference, mappedEventData)
                            console.log(`[CronHubtel] ✅ Dealer subscription ${payment.reference} activated`)
                        } else {
                            await processCompletedWalletPayment(
                                payment.reference,
                                mappedEventData,
                                payment.user_id
                            )
                            console.log(`[CronHubtel] ✅ Wallet payment ${payment.reference} credited`)
                        }

                        results.credited++
                    } else if (new Date(payment.created_at) < failureCutoff) {
                        // 'Unpaid' / 'Refunded' well past the approval window — give up.
                        // Before the cutoff the customer may still approve the prompt,
                        // so an Unpaid reading is left alone.
                        await (supabase.from('wallet_payments') as any)
                            .update({ status: 'failed', updated_at: new Date().toISOString() })
                            .eq('id', payment.id)
                            .eq('status', 'pending')
                        results.failed++
                        console.log(`[CronHubtel] ❌ Payment ${payment.reference} marked failed (${statusResult.status})`)
                    } else {
                        results.stillPending++
                    }
                } catch (err: any) {
                    console.error(`[CronHubtel] Error for ${payment.id}:`, err)
                    results.errors.push(`${payment.reference}: ${err.message}`)
                }
            })

            await Promise.all(checkPromises)
        }
    } catch (err: any) {
        console.error('[CronHubtel] Sweep failed:', err)
        results.errors.push(`sweep: ${err.message}`)
    }

    results.totalTimeMs = Date.now() - startTime
    console.log('[CronHubtel] Run complete:', results)
    return NextResponse.json({ success: true, ...results })
}
