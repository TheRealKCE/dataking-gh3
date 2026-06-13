import { NextRequest, NextResponse } from 'next/server'
import { areCronJobsEnabled, cronDisabledResponse, isValidCronRequest } from '@/lib/cron-control'

/**
 * DEPRECATED — This route previously verified pending payments via Paystack.
 * The platform now uses Moolre as the payment gateway.
 * Use /api/cron/verify-moolre-payments instead.
 */
export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    if (!isValidCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.warn('[CronDeprecated] verify-pending-payments is deprecated. Use /api/cron/verify-moolre-payments instead.')

    return NextResponse.json({
        deprecated: true,
        message: 'This cron job is deprecated. The platform now uses Moolre for payment processing. Please update your cron schedule to call /api/cron/verify-moolre-payments instead.',
        replacement: '/api/cron/verify-moolre-payments',
    })
}
