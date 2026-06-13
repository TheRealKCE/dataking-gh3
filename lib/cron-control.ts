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

/**
 * Validates that CRON_SECRET is set and has sufficient entropy.
 * Call this at the top of every cron route handler.
 * Throws an error (which produces a 500) if the secret is missing or too short.
 */
export function validateCronSecret(): void {
    const secret = process.env.CRON_SECRET
    if (!secret || secret.trim().length < 32) {
        throw new Error(
            '[CronControl] CRON_SECRET must be at least 32 characters. ' +
            'Set a strong secret in your environment variables.'
        )
    }
}

/**
 * Checks if the request has a valid Authorization header matching CRON_SECRET.
 * Handles potential whitespace and case-sensitivity in header names.
 */
export function isValidCronRequest(request: Request): boolean {
    const secret = process.env.CRON_SECRET
    if (!secret) return false

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader) return false

    const [type, token] = authHeader.split(' ')
    if (type.toLowerCase() !== 'bearer' || !token) return false

    return token.trim() === secret.trim()
}
