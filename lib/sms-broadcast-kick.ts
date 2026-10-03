import { waitUntil } from '@vercel/functions'

/**
 * Starts (or restarts) the self-chaining SMS broadcast processor for a job.
 *
 * The processor answers 202 straight away and sends inside its own waitUntil, so
 * awaiting this costs milliseconds and never ties the caller to the chain.
 *
 * Server-to-server with no browser session to forward, so it authenticates with
 * CRON_SECRET (see middleware.ts).
 */
export async function triggerSmsBroadcast(origin: string, jobId: string, source: string): Promise<void> {
    try {
        const res = await fetch(`${origin}/api/admin/sms-broadcast/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({ jobId }),
            signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) console.error(`[SMSBroadcast:${source}] Processor answered`, res.status, 'job:', jobId)
    } catch (err: any) {
        console.error(`[SMSBroadcast:${source}] Failed to reach processor:`, err?.message, 'job:', jobId)
    }
}

/**
 * triggerSmsBroadcast for a route that is about to return.
 *
 * A bare un-awaited fetch is not guaranteed to leave the function: Vercel freezes
 * the instance as soon as the response is sent, so the request to the next batch
 * was sometimes never made and the whole broadcast stopped dead (seen at
 * 40 / 2627). waitUntil keeps the instance alive until the request is out.
 */
export function kickSmsBroadcast(origin: string, jobId: string, source: string): void {
    waitUntil(triggerSmsBroadcast(origin, jobId, source))
}

/** A processing job that has not moved for this long is treated as stalled and restarted. */
export const SMS_BROADCAST_STALL_MS = 45_000
