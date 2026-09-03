import { NextRequest } from 'next/server'
import {
    validateApiKey, isApiError, apiSuccessV2, apiError,
    logApiRequest, getClientIp, enforceRateLimit,
} from '@/lib/api-auth'
import { generateReferenceCode } from '@/lib/utils'
import { waitUntil } from '@vercel/functions'
import { sendPushToAdmins } from '@/lib/web-push'
import {
    buildUtilityIntent, utilitySettingKeys, isUtilityVisibleTo, UTILITY_LAUNCH_KEY,
} from '@/lib/utility-order-intent'
import { triggerUtilityFulfillment, buildUtilityClientReference } from '@/lib/utility-fulfillment-dispatcher'
import { isUtilityService, UTILITY_SERVICES } from '@/lib/hubtel-utility-service'
import { isDuplicateReferenceError } from '@/lib/api-v2-networks'

/**
 * Wallet-funded bill payment over the Commission Services key.
 *
 * Mirrors app/api/utilities/create/route.ts. The account is re-verified against the
 * provider by buildUtilityIntent() BEFORE the wallet is touched — that re-query is
 * the only thing standing between a mistyped digit and a stranger's bill, so it is
 * never skipped in favour of trusting what /utilities/query returned earlier.
 *
 * Priced on the 'api' fee band, which ships at 0.
 */
const ENDPOINT = '/api/v2/utilities/pay'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = getClientIp(request)

    const auth = await validateApiKey(request, { version: 'v2', kind: 'commission' })
    if (isApiError(auth)) {
        logApiRequest({ apiKeyId: null, userId: null, endpoint: ENDPOINT, method: 'POST', statusCode: (auth as any).status, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Auth failed' })
        return auth
    }

    const limited = await enforceRateLimit(auth, 'purchase')
    if (limited) return limited

    const { userId, apiKeyId, userRole, supabase } = auth

    let body: any
    try { body = await request.json() } catch {
        return apiError(400, 'Invalid JSON body')
    }

    const { service, account_number, amount, phone, email, reference: clientRef } = body

    if (!isUtilityService(service)) {
        return apiError(400, `Unknown service. Must be one of: ${Object.keys(UTILITY_SERVICES).join(', ')}`)
    }

    const { data: settingsRows } = await (supabase.from('admin_settings') as any)
        .select('key, value')
        .in('key', [...utilitySettingKeys(service), UTILITY_LAUNCH_KEY])

    const settings: Record<string, string> = {}
    for (const row of ((settingsRows as any[]) || [])) settings[row.key] = row.value

    if (!isUtilityVisibleTo(userRole, settings)) {
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 403, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Utilities not launched' })
        return apiError(403, 'Bill payment endpoints are not available yet.')
    }

    // Idempotency BEFORE the provider round trip: a retried request must not spend
    // another account lookup, let alone place a second payment.
    //
    // Scoped to this caller. reference_code is UNIQUE across the whole table, so an
    // unscoped lookup would hand one partner another partner's order — including the
    // bill payer's name — the moment the two happened to pick the same string.
    if (clientRef) {
        const { data: existing } = await (supabase.from('utility_orders') as any)
            .select('id, reference_code, status, service, account_number, account_name, bill_amount, total_paid')
            .eq('reference_code', clientRef)
            .eq('user_id', userId)
            .maybeSingle()

        if (existing) {
            logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 200, responseTimeMs: Date.now() - startTime, ip })
            return apiSuccessV2({
                order_id:       existing.id,
                reference:      existing.reference_code,
                status:         existing.status,
                service:        existing.service,
                account_number: existing.account_number,
                account_name:   existing.account_name,
                bill_amount:    existing.bill_amount,
                total_paid:     existing.total_paid,
            }, { cached: true })
        }
    }

    const built = await buildUtilityIntent(
        { service, accountNumber: account_number, amount, phone, email },
        settings,
        'api'
    )

    if (!built.ok) {
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: built.status, responseTimeMs: Date.now() - startTime, ip, errorMessage: built.error })
        return apiError(built.status, built.error)
    }

    const intent = built.intent

    const { data: deductResult, error: deductError } = await (supabase as any).rpc('deduct_wallet_balance', {
        p_user_id: userId,
        p_amount: intent.totalPaid,
    })

    if (deductError) {
        if (deductError.message?.includes('INSUFFICIENT_BALANCE')) {
            logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 402, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Insufficient balance' })
            return apiError(402, 'Insufficient wallet balance. Top up your wallet and retry.')
        }
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 500, responseTimeMs: Date.now() - startTime, ip, errorMessage: deductError.message })
        return apiError(500, 'Payment processing failed')
    }

    const walletRow = deductResult?.[0] || deductResult
    const walletId = walletRow?.wallet_id
    const newBalance = walletRow?.new_balance

    if (!walletId) return apiError(404, 'Wallet not found')

    const referenceCode = clientRef || `UTIL-${generateReferenceCode()}`

    const { data: order, error: orderError } = await (supabase.from('utility_orders') as any)
        .insert({
            user_id:          userId,
            user_role:        userRole,
            service:          intent.service,
            account_number:   intent.accountNumber,
            account_name:     intent.accountName,
            destination:      intent.destination,
            customer_phone:   intent.customerPhone,
            customer_email:   intent.customerEmail,
            session_id:       intent.sessionId,
            bill_amount:      intent.billAmount,
            fee_rate:         intent.feeRate,
            fee_amount:       intent.feeAmount,
            total_paid:       intent.totalPaid,
            payment_method:   'wallet',
            payment_status:   'paid',
            status:           'pending',
            reference_code:   referenceCode,
            client_reference: buildUtilityClientReference(referenceCode),
            api_key_id:       apiKeyId,
        })
        .select()
        .single()

    if (orderError || !order) {
        // Nothing was bought — put the money straight back.
        await (supabase as any).rpc('credit_wallet_balance', { p_user_id: userId, p_amount: intent.totalPaid }).catch(() => {})

        if (isDuplicateReferenceError(orderError)) {
            logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 409, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Duplicate reference' })
            return apiError(409, `The reference "${referenceCode}" is already in use. Choose another.`)
        }

        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 500, responseTimeMs: Date.now() - startTime, ip, errorMessage: orderError?.message })
        return apiError(500, 'Failed to create order')
    }

    ;(supabase.from('wallet_transactions') as any).insert({
        wallet_id:   walletId,
        user_id:     userId,
        type:        'debit',
        amount:      intent.totalPaid,
        description: `API ${intent.label}: GHS ${intent.billAmount.toFixed(2)} → ${intent.accountNumber}`,
        reference:   referenceCode,
        source:      'api_purchase',
        status:      'completed',
    }).then(() => {}).catch(() => {})

    sendPushToAdmins({
        title: 'New API Bill Payment',
        body: `API: ${intent.label} GHS ${intent.billAmount.toFixed(2)} → ${intent.accountNumber}`,
        url: '/admin/utilities',
    }).catch(() => {})

    waitUntil(triggerUtilityFulfillment((order as any).id))

    logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 201, responseTimeMs: Date.now() - startTime, ip })

    return apiSuccessV2({
        order_id:       (order as any).id,
        reference:      referenceCode,
        status:         'pending',
        service:        intent.service,
        account_number: intent.accountNumber,
        account_name:   intent.accountName,
        bill_amount:    intent.billAmount,
        fee_amount:     intent.feeAmount,
        total_paid:     intent.totalPaid,
        new_balance:    newBalance,
    })
}
