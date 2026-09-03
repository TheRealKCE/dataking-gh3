import { NextRequest } from 'next/server'
import {
    validateApiKey, isApiError, apiSuccessV2, apiError,
    logApiRequest, getClientIp, enforceRateLimit,
} from '@/lib/api-auth'

/**
 * Spending balance. This is the wallet orders are charged against — commission
 * EARNINGS live in a different wallet, at /api/v2/commission/balance.
 *
 * Readable with either key kind: a commission partner pays for bills out of this
 * balance, so they need to be able to check it.
 */
const ENDPOINT = '/api/v2/wallet/balance'

export async function GET(request: NextRequest) {
    const startTime = Date.now()
    const ip = getClientIp(request)

    const auth = await validateApiKey(request, { version: 'v2' })
    if (isApiError(auth)) {
        logApiRequest({ apiKeyId: null, userId: null, endpoint: ENDPOINT, method: 'GET', statusCode: (auth as any).status, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Auth failed' })
        return auth
    }

    const limited = await enforceRateLimit(auth, 'balance')
    if (limited) return limited

    const { userId, apiKeyId, supabase } = auth

    const { data: wallet, error } = await (supabase.from('wallets') as any)
        .select('balance, total_spent')
        .eq('user_id', userId)
        .single()

    if (error || !wallet) {
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'GET', statusCode: 404, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Wallet not found' })
        return apiError(404, 'Wallet not found')
    }

    logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'GET', statusCode: 200, responseTimeMs: Date.now() - startTime, ip })

    return apiSuccessV2({
        balance:     (wallet as any).balance,
        total_spent: (wallet as any).total_spent,
        currency:    'GHS',
    })
}
