import { NextResponse } from 'next/server'

export function areCronJobsEnabled() {
    return process.env.CRON_JOBS_ENABLED === 'true'
}

export function cronDisabledResponse() {
    return NextResponse.json(
        {
            disabled: true,
            message: 'Cron jobs are disabled by CRON_JOBS_ENABLED=false.',
        },
        {
            status: 200,
            headers: {
                'Cache-Control': 'private, no-store',
            },
        }
    )
}

