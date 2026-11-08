import { NextRequest, NextResponse } from 'next/server'
import { reconcileKuntaniiOrders } from '@/lib/kuntanii-reconcile'
import { areCronJobsEnabled, cronDisabledResponse } from '@/lib/cron-control'
import { sendPushToAdmins } from '@/lib/web-push'

// Kuntanii reconciliation cron — the safety net behind app/api/webhooks/kuntanii.
// The logic lives in lib/kuntanii-reconcile (shared with the admin Sync button).
//
// Scheduling:
//   • cron-job.org → GET https://arhmsgh.com/api/cron/sync-kuntanii-status
//     with header `Authorization: Bearer <CRON_SECRET>`, every 10 min. NEVER the
//     www host — the cross-host 307 strips the auth header.
//
// CRON_JOBS_ENABLED must be 'true'. When it is not, this returns HTTP 200
// {"disabled": true} and the console stays GREEN while nothing reconciles.

export const maxDuration = 60

export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await reconcileKuntaniiOrders()

    if (result.errors.length > 0) {
        await sendPushToAdmins({
            title: 'Kuntanii sync failing',
            body: result.errors[0],
            url: '/admin/orders',
            tag: 'kuntanii-sync-error',
        }).catch(() => {})
    }

    return NextResponse.json(result)
}

// Accept any method (cron-job.org's sent method doesn't always match its UI); auth-gated.
export const POST = GET
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
