import { NextRequest } from 'next/server'
import {
    validateApiKey, isApiError, apiSuccess, apiError,
    logApiRequest, getClientIp,
} from '@/lib/api-auth'

const ENDPOINT = '/api/v1/orders/:reference'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ reference: string }> }
) {
    const startTime = Date.now()
    const ip = getClientIp(request)

    const auth = await validateApiKey(request)
    if (isApiError(auth)) {
        logApiRequest({ apiKeyId: null, userId: null, endpoint: ENDPOINT, method: 'GET', statusCode: (auth as any).status, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Auth failed' })
        return auth
    }

    const { userId, apiKeyId, supabase } = auth
    const { reference } = await params

    if (!reference || reference.length > 100) {
        return apiError(400, 'Invalid reference')
    }

    // Look up by reference_code, scoped to this user's API key
    const { data: order } = await (supabase.from('orders') as any)
        .select('id, reference_code, status, payment_status, network, size, phone_number, price, created_at, updated_at, fulfillment_method')
        .eq('reference_code', reference)
        .eq('api_key_id', apiKeyId)
        .maybeSingle()

    // Also allow lookup without api_key_id filter (for orders placed via web that user wants to check)
    const result = order || (await (supabase.from('orders') as any)
        .select('id, reference_code, status, payment_status, network, size, phone_number, price, created_at, updated_at, fulfillment_method')
        .eq('reference_code', reference)
        .eq('user_id', userId)
        .maybeSingle()
    ).data

    if (!result) {
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'GET', statusCode: 404, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Order not found' })
        return apiError(404, `No order found with reference: ${reference}`)
    }

    logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'GET', statusCode: 200, responseTimeMs: Date.now() - startTime, ip })

    return apiSuccess({
        order_id:       result.id,
        reference:      result.reference_code,
        status:         result.status,
        payment_status: result.payment_status,
        network:        result.network,
        size:           result.size,
        recipient:      result.phone_number,
        amount:         result.price,
        fulfillment:    result.fulfillment_method,
        created_at:     result.created_at,
        updated_at:     result.updated_at,
    })
}
