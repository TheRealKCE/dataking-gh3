import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { verifyMtnWhitelist } from '@/lib/agentportal-service'
import { verifyMtnNumbers } from '@/lib/bundleportal-service'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { recordRegistrationResults } from '@/lib/mtn-registration-gate'

export const maxDuration = 60

const MAX_NUMBERS = 1000
// Server 2 (BundlePortal) is one upstream call per number, so it takes fewer.
const MAX_NUMBERS_SERVER_2 = 200

type Server = 1 | 2

type CheckStatus = 'registered' | 'submitted' | 'invalid' | 'not_mtn'

interface CheckResult {
    input: string
    normalized: string
    status: CheckStatus
    reason?: string
}

/**
 * Check whether MTN numbers are enabled ("whitelisted") for data on a supplier.
 *
 * Server 1 = Agent Portal: numbers that are not yet enabled are auto-submitted to MTN
 * by the same upstream call and are usually ready within 2 weeks.
 * Server 2 = BundlePortal: check only - an unregistered number is NOT submitted.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let body: { numbers?: unknown; server?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const server: Server = Number(body?.server) === 2 ? 2 : 1
        const maxNumbers = server === 2 ? MAX_NUMBERS_SERVER_2 : MAX_NUMBERS

        if (!(server === 2 ? process.env.BUNDLEPORTAL_API_KEY : process.env.AGENTPORTAL_API_KEY)) {
            return NextResponse.json(
                { error: `Server ${server} is temporarily unavailable. Please try the other server.` },
                { status: 503 }
            )
        }

        const rawNumbers = body?.numbers

        if (!Array.isArray(rawNumbers) || rawNumbers.length === 0) {
            return NextResponse.json({ error: 'No numbers provided' }, { status: 400 })
        }

        if (rawNumbers.length > maxNumbers) {
            return NextResponse.json(
                { error: `Maximum ${maxNumbers} numbers per check on Server ${server}` },
                { status: 400 }
            )
        }

        // Classify every input, preserving order so the UI table lines up with the paste
        const results: CheckResult[] = []
        const uniqueMtn = new Set<string>()
        let duplicates = 0

        for (const raw of rawNumbers) {
            const input = String(raw ?? '').trim()

            if (!input) {
                results.push({ input, normalized: '', status: 'invalid', reason: 'Empty' })
                continue
            }

            const validation = validateGhanaianPhone(input)

            if (!validation.isValid) {
                results.push({
                    input,
                    normalized: '',
                    status: 'invalid',
                    reason: validation.error || 'Invalid number',
                })
                continue
            }

            if (validation.network !== 'MTN') {
                results.push({
                    input,
                    normalized: validation.normalizedNumber,
                    status: 'not_mtn',
                    reason: `${validation.network} number`,
                })
                continue
            }

            if (uniqueMtn.has(validation.normalizedNumber)) {
                duplicates++
            } else {
                uniqueMtn.add(validation.normalizedNumber)
            }

            // Status filled in after the upstream call
            results.push({ input, normalized: validation.normalizedNumber, status: 'submitted' })
        }

        if (uniqueMtn.size === 0) {
            return NextResponse.json({
                server,
                results,
                summary: buildSummary(results, duplicates),
            })
        }

        if (server === 2) {
            const { success, allowed, inFlight, failed, error } = await verifyMtnNumbers(Array.from(uniqueMtn))

            if (!success) {
                return NextResponse.json(
                    { error: error || 'Could not reach Server 2 right now. Please try Server 1.' },
                    { status: 502 }
                )
            }

            for (const result of results) {
                if (result.status !== 'submitted') continue
                if (failed.has(result.normalized)) {
                    result.status = 'invalid'
                    result.reason = 'Could not check - try again'
                } else if (allowed.has(result.normalized)) {
                    result.status = 'registered'
                    if (inFlight.has(result.normalized)) result.reason = 'An earlier order is still in progress'
                } else {
                    result.reason = 'Not registered on Server 2'
                }
            }

            // No cache write: the purchase gate reads Agent Portal registration, and a
            // number approved on BundlePortal is not necessarily approved there.
            return NextResponse.json({
                server,
                results,
                summary: buildSummary(results, duplicates),
            })
        }

        const { success, allowed, error } = await verifyMtnWhitelist(Array.from(uniqueMtn))

        if (!success) {
            return NextResponse.json(
                { error: error || 'Could not reach MTN right now. Please try again.' },
                { status: 502 }
            )
        }

        for (const result of results) {
            if (result.status !== 'submitted') continue
            result.status = allowed.has(result.normalized) ? 'registered' : 'submitted'
        }

        // Feed the same cache the purchase gate reads, so checking numbers here makes
        // the subsequent order cost no extra upstream call. Best-effort: a failed
        // cache write must not fail the check the user actually asked for.
        try {
            const admin = createServerClient()
            await recordRegistrationResults(
                admin,
                Array.from(uniqueMtn).map(number => ({
                    phoneNumber: number,
                    isRegistered: allowed.has(number),
                }))
            )
        } catch (cacheErr: any) {
            console.error('[MTN CheckRegistration] Cache warm failed:', cacheErr?.message)
        }

        return NextResponse.json({
            server,
            results,
            summary: buildSummary(results, duplicates),
        })
    } catch (err: any) {
        console.error('[MTN CheckRegistration] Error:', err)
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }
}

function buildSummary(results: CheckResult[], duplicates: number) {
    return {
        total: results.length,
        registered: results.filter(r => r.status === 'registered').length,
        submitted: results.filter(r => r.status === 'submitted').length,
        invalid: results.filter(r => r.status === 'invalid').length,
        not_mtn: results.filter(r => r.status === 'not_mtn').length,
        duplicates,
    }
}
