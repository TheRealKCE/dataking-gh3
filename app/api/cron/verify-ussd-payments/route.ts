/**
 * USSD (Paystack Mobile Money) reconciliation sweep.
 *
 * The safety net for a charge whose webhook never arrived. USSD needs this more
 * than any other flow: there is no browser to poll /api/payments/verify, and the
 * customer hung up the moment we released the session. If the webhook is lost,
 * nothing else in the system will ever notice — the money is in and the bundle
 * never went out.
 *
 * Unlike most crons here there is deliberately NO areCronJobsEnabled() guard, the
 * same stance as verify-hubtel-payments / verify-moolre-payments /
 * verify-payswitch-payments: a global cron kill switch must not be able to strand
 * a customer's money.
 *
 * Pending work is read from hubtel_payment_logs rather than wallet_payments,
 * because a USSD caller has no account and therefore no wallet_payments row (that
 * table needs user_id and wallet_id NOT NULL).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { verifyTransaction } from '@/lib/paystack-momo-service'
import { logStatusCheck } from '@/lib/hubtel-payment-log'
import { ensureUssdSession } from '@/lib/ussd-reference'

/** Give the webhook a head start before second-guessing it. */
const MIN_AGE_MS = 3 * 60 * 1000
/** Past this, the Redis mirror has expired and there is nothing left to fulfil. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000
/** Keeps one invocation inside the function time limit. */
const BATCH_LIMIT = 15

export async function GET(request: NextRequest) {
    const startTime = Date.now()

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const results = {
        checked: 0,
        fulfilled: 0,
        stillPending: 0,
        failed: 0,
        unresolvable: 0,
        errors: [] as string[],
        totalTimeMs: 0,
    }

    try {
        const { data: pending, error: fetchError } = await (supabase
            .from('hubtel_payment_logs') as any)
            .select('client_reference, amount, created_at')
            .eq('flow', 'ussd')
            .eq('status', 'pending')
            // The old Hubtel AddToCart path also wrote flow='ussd' rows, keyed by
            // Hubtel's OrderId. Those are not Paystack references and verifying them
            // would 404 forever, so match our prefix explicitly.
            .like('client_reference', 'USSD-%')
            .lt('created_at', new Date(Date.now() - MIN_AGE_MS).toISOString())
            .gt('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
            .order('created_at', { ascending: true })
            .limit(BATCH_LIMIT)

        if (fetchError) {
            console.error('[CronUssd] hubtel_payment_logs query error:', fetchError)
            results.errors.push(`query: ${fetchError.message}`)
            results.totalTimeMs = Date.now() - startTime
            return NextResponse.json({ success: false, ...results })
        }

        for (const row of (pending || [])) {
            const reference = String(row.client_reference)
            results.checked++

            try {
                const verified = await verifyTransaction(reference)

                if (verified.outcome === 'pending') {
                    results.stillPending++
                    continue
                }

                if (verified.outcome === 'failed') {
                    results.failed++
                    await logStatusCheck({
                        clientReference: reference,
                        status: 'failed',
                        message: verified.message ?? `Paystack status: ${verified.rawStatus ?? 'failed'}`,
                        raw: verified.raw,
                    })
                    continue
                }

                // Paid. Paystack's figure is authoritative over anything we stored.
                const amountPaid = (verified.amountPesewas ?? 0) / 100
                const resolved = await ensureUssdSession(supabase, reference)

                if (!resolved) {
                    results.unresolvable++
                    console.error('[CronUssd] Paid but unresolvable, needs a human:', reference)
                    await logStatusCheck({
                        clientReference: reference,
                        status: 'failed',
                        amount: amountPaid,
                        message: 'Paid but the USSD order could not be resolved (mirror expired).',
                        raw: verified.raw,
                    })
                    continue
                }

                const deferredWork: Array<() => Promise<void>> = []
                // Both fulfillers are idempotent on referenceCode, so racing the
                // webhook here is safe — whichever arrives second is a no-op.
                const result = resolved.orderType === 'data'
                    ? await (await import('@/lib/ussd-data-fulfillment')).fulfillUSSDDataBySession({
                        sessionId: resolved.sessionId,
                        referenceCode: reference,
                        amountPaid,
                        deferredWork,
                    })
                    : await (await import('@/lib/ussd-rc-fulfillment')).fulfillUSSDRCBySession({
                        sessionId: resolved.sessionId,
                        referenceCode: reference,
                        amountPaid,
                        deferredWork,
                    })

                await logStatusCheck({
                    clientReference: reference,
                    status: result.success ? 'success' : 'failed',
                    amount: amountPaid,
                    message: result.success
                        ? 'Recovered by reconciliation sweep.'
                        : `Paid but fulfilment failed: ${result.error ?? 'unknown error'}`,
                    raw: verified.raw,
                })

                if (result.success) {
                    results.fulfilled++
                } else {
                    results.failed++
                    console.error('[CronUssd] Fulfilment failed:', reference, result.error)
                }

                for (const task of deferredWork) {
                    await task().catch(() => {})
                }
            } catch (err: any) {
                console.error('[CronUssd] Error on', reference, err?.message)
                results.errors.push(`${reference}: ${err?.message ?? 'unknown'}`)
            }
        }
    } catch (err: any) {
        console.error('[CronUssd] Sweep failed:', err)
        results.errors.push(`sweep: ${err?.message ?? 'unknown'}`)
    }

    results.totalTimeMs = Date.now() - startTime
    console.log('[CronUssd] Sweep complete:', JSON.stringify(results))
    return NextResponse.json({ success: true, ...results })
}
