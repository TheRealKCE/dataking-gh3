import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServerClient } from '@/lib/supabase'
import { sendSMS, getActiveSmsProvider, normalizeGhanaPhone } from '@/lib/sms-service'
import { sendKingFlexyBulkSMS, isKingFlexySmsConfigured, KF_INLINE_RECIPIENTS } from '@/lib/kingflexy-sms-service'
import { triggerSmsBroadcast } from '@/lib/sms-broadcast-kick'
import { z } from 'zod'

// Vercel Hobby plan has no cron headroom for a "poll every N minutes" worker,
// and the old inline-loop approach timed out on large lists (see sms-broadcast
// route.ts). Instead each invocation sends batches for a bounded time, then
// fires a request at itself to carry on — the job keeps moving forward across
// many short-lived invocations instead of one long one.
//
// The work runs inside waitUntil and the route answers immediately. That keeps
// each hop independent: the caller's request completes in milliseconds, so no
// invocation is ever held open waiting on the rest of the chain.
export const maxDuration = 60

const BATCH_SIZE = 10
const MAX_ERRORS_STORED = 200
/** Stop starting new batches after this long and hand over to a fresh invocation. */
const INVOCATION_BUDGET_MS = 25_000

const processSchema = z.object({
    jobId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
    // Defense in depth: middleware.ts already gates this exact path on the
    // same header before the request reaches here. Checked again in case
    // that config ever drifts — this route moves real SMS spend and must
    // never be reachable without the shared secret.
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = processSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { jobId } = parsed.data
    const origin = request.nextUrl.origin

    waitUntil(
        runBatches(jobId, origin).catch(err => {
            // The status poll restarts a job that stops moving, so a crash here
            // costs a pause, not the broadcast.
            console.error('[SMSBroadcastProcess] Run failed:', jobId, err)
        })
    )

    return NextResponse.json({ accepted: true }, { status: 202 })
}

async function runBatches(jobId: string, origin: string): Promise<void> {
    const supabase = createServerClient()
    const startedAt = Date.now()

    // KingFlexy takes a whole list in one call. Sending it one person at a time
    // meant 2627 separate requests for one broadcast — slow, and a handful of
    // gateway failures tripped the client's circuit breaker, after which every
    // remaining recipient failed instantly. In bulk mode a 2627-person broadcast
    // is six calls. isKingFlexySmsConfigured() is the capability half: the
    // setting can name a gateway whose key was never added.
    const bulk = (await getActiveSmsProvider('main')) === 'kingflexy' && isKingFlexySmsConfigured()
    const batchSize = bulk ? KF_INLINE_RECIPIENTS : BATCH_SIZE

    while (Date.now() - startedAt < INVOCATION_BUDGET_MS) {
        const { data: jobRaw, error: jobError } = await (supabase
            .from('sms_broadcast_jobs') as any)
            .select('*')
            .eq('id', jobId)
            .single()

        if (jobError || !jobRaw) {
            console.error('[SMSBroadcastProcess] Job not found:', jobId, jobError)
            return
        }

        const job = jobRaw as any
        if (job.status === 'completed' || job.status === 'failed') return

        const recipients: any[] = job.recipients || []
        const alreadyProcessed: number = job.sent_count || 0
        const batch = recipients.slice(alreadyProcessed, alreadyProcessed + batchSize)

        if (batch.length === 0) {
            await (supabase.from('sms_broadcast_jobs') as any)
                .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', jobId)
            return
        }

        // Claim the batch BEFORE sending it. Only the invocation whose update
        // still sees the old sent_count wins; a duplicate (a restart from the
        // status poll racing a chained hop) matches no row and backs off, so no
        // recipient is ever texted twice.
        const newSentCount = alreadyProcessed + batch.length
        const isDone = newSentCount >= recipients.length
        const { data: claimed, error: claimError } = await (supabase
            .from('sms_broadcast_jobs') as any)
            .update({
                sent_count: newSentCount,
                status: 'processing',
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId)
            .eq('sent_count', alreadyProcessed)
            .select('id')

        if (claimError) {
            console.error('[SMSBroadcastProcess] Claim failed:', jobId, claimError)
            return
        }
        if (!claimed || claimed.length === 0) {
            // Someone else is already on this batch.
            return
        }

        let batchSuccess = 0
        let batchFailed = 0
        const batchErrors: string[] = []

        if (bulk) {
            const numbers: string[] = []
            for (const recipient of batch) {
                const phone = normalizeGhanaPhone(String(recipient.phone_number || ''))
                if (phone) {
                    numbers.push(phone)
                } else {
                    batchFailed++
                    batchErrors.push(`${recipient.first_name || 'Unknown'}: invalid phone number ${recipient.phone_number || '(none)'}`)
                }
            }
            if (numbers.length > 0) {
                const result = await sendKingFlexyBulkSMS({
                    message: job.message,
                    recipients: numbers,
                    // Their idempotency key: a re-run of this same slice returns the
                    // original campaign instead of texting everyone twice.
                    reference: `arhms_bc_${jobId}_${alreadyProcessed}`.slice(0, 100),
                })
                if (result.ok) {
                    batchSuccess += result.sent
                    batchFailed += result.failed
                } else {
                    batchFailed += numbers.length
                    batchErrors.push(`${numbers.length} recipients: ${result.outOfCredits ? 'KingFlexy SMS credits exhausted - top up at kingflexygh.com' : (result.error || 'Send failed')}`)
                    console.error('[SMSBroadcastProcess] Bulk send failed:', jobId, result.error)
                }
            }
        } else await Promise.allSettled(
            batch.map(async (recipient: any) => {
                try {
                    const result = await sendSMS({ recipient: recipient.phone_number, message: job.message })
                    if (result.success) {
                        batchSuccess++
                    } else {
                        batchFailed++
                        batchErrors.push(`${recipient.first_name || 'Unknown'}: ${result.error}`)
                    }
                } catch (err: any) {
                    batchFailed++
                    batchErrors.push(`${recipient.first_name || 'Unknown'}: ${err.message}`)
                }
            })
        )

        // Re-read the counters right before writing them: only the claim holder
        // writes them, but reading fresh keeps a slow batch from overwriting a
        // newer total.
        const { data: fresh } = await (supabase
            .from('sms_broadcast_jobs') as any)
            .select('success_count, failed_count, errors')
            .eq('id', jobId)
            .single()

        const base = (fresh as any) || job
        await (supabase.from('sms_broadcast_jobs') as any)
            .update({
                success_count: (base.success_count || 0) + batchSuccess,
                failed_count: (base.failed_count || 0) + batchFailed,
                errors: [...(base.errors || []), ...batchErrors].slice(-MAX_ERRORS_STORED),
                status: isDone ? 'completed' : 'processing',
                completed_at: isDone ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId)

        if (isDone) return
    }

    // Out of time for this invocation — hand the rest to a fresh one.
    await triggerSmsBroadcast(origin, jobId, 'process')
}
