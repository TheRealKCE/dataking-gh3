import { NextRequest } from 'next/server'
import {
    validateApiKey, isApiError, apiSuccessV2, apiError,
    logApiRequest, getClientIp, enforceRateLimit,
} from '@/lib/api-auth'
import { isUtilityVisibleTo, UTILITY_LAUNCH_KEY } from '@/lib/utility-order-intent'
import {
    queryUtilityAccount,
    UTILITY_SERVICES,
    isUtilityService,
} from '@/lib/hubtel-utility-service'

/**
 * Resolves an account number to the customer's name before anything is charged.
 *
 * A smartcard or meter number is a bare string of digits with no check digit, and a
 * mistyped one belongs to somebody else. A partner should show this name back to
 * their user and get a confirmation before calling /utilities/pay.
 *
 * Nothing returned here is trusted on the way back in: /utilities/pay re-runs the
 * same query server-side before it charges. This endpoint exists so the caller can
 * SEE the name, not so the server can learn it.
 */
const ENDPOINT = '/api/v2/utilities/query'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = getClientIp(request)

    const auth = await validateApiKey(request, { version: 'v2', kind: 'commission' })
    if (isApiError(auth)) {
        logApiRequest({ apiKeyId: null, userId: null, endpoint: ENDPOINT, method: 'POST', statusCode: (auth as any).status, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Auth failed' })
        return auth
    }

    // Rate-limited harder than a balance check: every call is a paid round trip to a
    // third party, and scanning it over a range of account numbers would enumerate
    // other people's names.
    const limited = await enforceRateLimit(auth, 'query')
    if (limited) return limited

    const { userId, apiKeyId, userRole, supabase } = auth

    // Same launch gate as the web path. Verifying an account costs us money, so it is
    // closed until utilities go public, not just the payment.
    const { data: gateRows } = await (supabase.from('admin_settings') as any)
        .select('key, value')
        .eq('key', UTILITY_LAUNCH_KEY)

    const gateSettings: Record<string, string> = {}
    for (const row of ((gateRows as any[]) || [])) gateSettings[row.key] = row.value

    if (!isUtilityVisibleTo(userRole, gateSettings)) {
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 403, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Utilities not launched' })
        return apiError(403, 'Bill payment endpoints are not available yet.')
    }

    let body: any
    try { body = await request.json() } catch {
        return apiError(400, 'Invalid JSON body')
    }

    const { service, account_number, phone } = body

    if (!isUtilityService(service)) {
        return apiError(400, `Unknown service. Must be one of: ${Object.keys(UTILITY_SERVICES).join(', ')}`)
    }

    const def = UTILITY_SERVICES[service]
    const accountNumber = String(account_number ?? '').replace(/\s+/g, '')
    const phoneRaw = String(phone ?? '').replace(/\s+/g, '')

    if (!def.accountPattern.test(accountNumber)) {
        return apiError(400, `Enter a valid ${def.accountLabel}.`)
    }
    if (def.requiresPhone && !/^0\d{9}$/.test(phoneRaw)) {
        return apiError(400, 'phone is required for this service. Use Ghana format: 0XXXXXXXXX')
    }

    const lookup = await queryUtilityAccount({
        service,
        accountNumber,
        phone: def.requiresPhone ? phoneRaw : undefined,
    })

    if (!lookup.success) {
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 400, responseTimeMs: Date.now() - startTime, ip, errorMessage: lookup.error })
        return apiError(400, lookup.error || `That ${def.accountLabel} could not be verified.`)
    }

    logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 200, responseTimeMs: Date.now() - startTime, ip })

    return apiSuccessV2({
        service,
        label:          def.label,
        account_number: accountNumber,
        account_name:   lookup.accountName ?? null,
        amount_due:     lookup.amountDue ?? null,
        // ECG answers with every meter on the phone number rather than confirming the
        // one asked for, so the caller picks from this list.
        meters:         lookup.meters ?? null,
        // session_id is deliberately NOT returned. It is single-use and Ghana Water
        // spends it on the payment; /utilities/pay obtains a fresh one for itself.
    })
}
