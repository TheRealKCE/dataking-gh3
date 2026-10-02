import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendSMS } from '@/lib/sms-service'
import { z } from 'zod'

// Vercel Hobby plan has no cron headroom for a "poll every N minutes" worker,
// and the old inline-loop approach timed out on large lists (see sms-broadcast
// route.ts). Instead each invocation sends one batch, then fires a
// fire-and-forget request at itself for the next batch — the job keeps moving
// forward across many short-lived invocations instead of one long one.
const BATCH_SIZE = 10
const MAX_ERRORS_STORED = 200

const processSchema = z.object({
    jobId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = processSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
        }
        const { jobId } = parsed.data

        const supabase = createServerClient()

        const { data: jobRaw, error: jobError } = await (supabase
            .from('sms_broadcast_jobs') as any)
            .select('*')
            .eq('id', jobId)
            .single()

        if (jobError || !jobRaw) {
            console.error('[SMSBroadcastProcess] Job not found:', jobId, jobError)
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        const job = jobRaw as any

        if (job.status === 'completed' || job.status === 'failed') {
            // Already finished (or a duplicate chained call arrived) — no-op.
            return NextResponse.json({ success: true, status: job.status })
        }

        const recipients: any[] = job.recipients
        const alreadyProcessed = job.sent_count
        const batch = recipients.slice(alreadyProcessed, alreadyProcessed + BATCH_SIZE)

        if (batch.length === 0) {
            // Nothing left — mark complete.
            await (supabase.from('sms_broadcast_jobs') as any)
                .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', jobId)
            return NextResponse.json({ success: true, status: 'completed' })
        }

        if (job.status === 'pending') {
            await (supabase.from('sms_broadcast_jobs') as any)
                .update({ status: 'processing', updated_at: new Date().toISOString() })
                .eq('id', jobId)
        }

        let batchSuccess = 0
        let batchFailed = 0
        const batchErrors: string[] = []

        await Promise.allSettled(
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

        const newSentCount = alreadyProcessed + batch.length
        const newSuccessCount = job.success_count + batchSuccess
        const newFailedCount = job.failed_count + batchFailed
        const combinedErrors = [...(job.errors || []), ...batchErrors].slice(-MAX_ERRORS_STORED)
        const isDone = newSentCount >= recipients.length

        await (supabase.from('sms_broadcast_jobs') as any)
            .update({
                sent_count: newSentCount,
                success_count: newSuccessCount,
                failed_count: newFailedCount,
                errors: combinedErrors,
                status: isDone ? 'completed' : 'processing',
                completed_at: isDone ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId)

        if (!isDone) {
            // Chain the next batch. Fire-and-forget so this invocation can
            // return quickly instead of waiting on the entire remaining job.
            const origin = request.nextUrl.origin
            fetch(`${origin}/api/admin/sms-broadcast/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId }),
            }).catch(err => console.error('[SMSBroadcastProcess] Failed to chain next batch:', err))
        }

        return NextResponse.json({
            success: true,
            status: isDone ? 'completed' : 'processing',
            sent: newSentCount,
            total: recipients.length,
        })
    } catch (error: any) {
        console.error('[SMSBroadcastProcess] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
