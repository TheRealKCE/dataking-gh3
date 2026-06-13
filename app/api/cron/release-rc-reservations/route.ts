import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { areCronJobsEnabled, cronDisabledResponse, isValidCronRequest } from '@/lib/cron-control'

/**
 * Cron Job: Release expired Results Checker voucher reservations.
 * Should run every 10-15 minutes via cron-job.org.
 * Secured with a Bearer token via the CRON_SECRET environment variable.
 */
export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    try {
        if (!isValidCronRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createServerClient()

        const { data, error } = await (supabase as any).rpc('release_expired_rc_reservations')

        if (error) {
            console.error('[RC Cron] Failed to release expired reservations:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const freedCount = data ?? 0
        console.log(`[RC Cron] Released ${freedCount} expired reservation(s)`)

        return NextResponse.json({
            success: true,
            freed: freedCount,
            timestamp: new Date().toISOString()
        })
    } catch (err: any) {
        console.error('[RC Cron] Error:', err)
        return NextResponse.json({ error: 'Cron execution failed' }, { status: 500 })
    }
}
