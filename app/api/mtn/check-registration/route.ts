import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { verifyMtnWhitelist } from '@/lib/agentportal-service'
import { validateGhanaianPhone } from '@/lib/phone-validation'

const MAX_NUMBERS = 1000

type CheckStatus = 'registered' | 'submitted' | 'invalid' | 'not_mtn'

interface CheckResult {
    input: string
    normalized: string
    status: CheckStatus
    reason?: string
}

/**
 * Check whether MTN numbers are enabled ("whitelisted") for data on the Agent Portal
 * supplier account. Numbers that are not yet enabled are auto-submitted to MTN by the
 * same upstream call and are usually ready within ~24h.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!process.env.AGENTPORTAL_API_KEY) {
            return NextResponse.json(
                { error: 'Number checking is temporarily unavailable. Please try again later.' },
                { status: 503 }
            )
        }

        let body: { numbers?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const rawNumbers = body?.numbers

        if (!Array.isArray(rawNumbers) || rawNumbers.length === 0) {
            return NextResponse.json({ error: 'No numbers provided' }, { status: 400 })
        }

        if (rawNumbers.length > MAX_NUMBERS) {
            return NextResponse.json(
                { error: `Maximum ${MAX_NUMBERS} numbers per check` },
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

        return NextResponse.json({
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
