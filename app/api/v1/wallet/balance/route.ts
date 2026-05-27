import { NextRequest } from 'next/server'
import {
    validateApiKey, isApiError, apiSuccess, apiError,
    logApiRequest, getClientIp,
} from '@/lib/api-auth'

const ENDPOINT = '/api/v1/wallet/balance'

export async function GET(request: NextRequest) {
    const startTime = Date.now()
    const ip = getClientIp(request)

    const auth = await validateApiKey(request)
    if (isApiError(auth)) {
        logApiRequest({ apiKeyId: null, userId: null, endpoint: ENDPOINT, method: 'GET', statusCode: (auth as any).status, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Auth failed' })
        return auth
    }

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

    return apiSuccess({
        balance:     (wallet as any).balance,
        total_spent: (wallet as any).total_spent,
        currency:    'GHS',
    })
}
