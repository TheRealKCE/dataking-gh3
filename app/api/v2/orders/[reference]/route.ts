import { NextRequest } from 'next/server'
import {
    validateApiKey, isApiError, apiSuccessV2, apiError,
    logApiRequest, getClientIp, enforceRateLimit,
} from '@/lib/api-auth'

/**
 * Status of a data or airtime order, by reference.
 *
 * v1 only knew about the `orders` table; airtime lives in its own, so one reference
 * has two places to look and the `type` field says which was found.
 *
 * Standard key only. Bill payments are deliberately NOT reachable here — they have
 * their own endpoint at /api/v2/utilities/orders/:reference, gated on the commission
 * key, which keeps the two products' surfaces from bleeding into each other.
 */
const ENDPOINT = '/api/v2/orders/:reference'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ reference: string }> }
) {
    const startTime = Date.now()
    const ip = getClientIp(request)

    const auth = await validateApiKey(request, { version: 'v2', kind: 'standard' })
    if (isApiError(auth)) {
        logApiRequest({ apiKeyId: null, userId: null, endpoint: ENDPOINT, method: 'GET', statusCode: (auth as any).status, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Auth failed' })
        return auth
    }

    const limited = await enforceRateLimit(auth, 'status')
    if (limited) return limited

    const { userId, apiKeyId, supabase } = auth
    const { reference } = await params

    if (!reference || reference.length > 100) {
        return apiError(400, 'Invalid reference')
    }

    /**
     * Scoped to this key first, then to the user. The second lookup is what lets a
     * caller check an order they placed in the dashboard; without it, only orders
     * created by this exact key would ever be visible.
     */
    async function lookup(table: string, columns: string): Promise<any | null> {
        const byKey = await (supabase.from(table) as any)
            .select(columns)
            .eq('reference_code', reference)
            .eq('api_key_id', apiKeyId)
            .maybeSingle()

        if (byKey.data) return byKey.data

        const byUser = await (supabase.from(table) as any)
            .select(columns)
            .eq('reference_code', reference)
            .eq('user_id', userId)
            .maybeSingle()

        return byUser.data ?? null
    }

    const dataOrder = await lookup(
        'orders',
        'id, reference_code, status, payment_status, network, size, phone_number, price, source, created_at, updated_at, fulfillment_method'
    )

    if (dataOrder) {
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'GET', statusCode: 200, responseTimeMs: Date.now() - startTime, ip })
        return apiSuccessV2({
            type:           'data',
            order_id:       dataOrder.id,
            reference:      dataOrder.reference_code,
            status:         dataOrder.status,
            payment_status: dataOrder.payment_status,
            network:        dataOrder.network,
            size:           dataOrder.size,
            recipient:      dataOrder.phone_number,
            price:          dataOrder.price,
            source:         dataOrder.source,
            created_at:     dataOrder.created_at,
            updated_at:     dataOrder.updated_at,
        })
    }

    const airtimeOrder = await lookup(
        'airtime_orders',
        'id, reference_code, status, type, network, beneficiary_phone, airtime_amount, fee_amount, total_paid, created_at, updated_at, fulfillment_note'
    )

    if (airtimeOrder) {
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'GET', statusCode: 200, responseTimeMs: Date.now() - startTime, ip })
        return apiSuccessV2({
            type:           airtimeOrder.type === 'mashup' ? 'mashup' : 'airtime',
            order_id:       airtimeOrder.id,
            reference:      airtimeOrder.reference_code,
            status:         airtimeOrder.status,
            network:        airtimeOrder.network,
            recipient:      airtimeOrder.beneficiary_phone,
            airtime_amount: airtimeOrder.airtime_amount,
            fee_amount:     airtimeOrder.fee_amount,
            total_paid:     airtimeOrder.total_paid,
            note:           airtimeOrder.fulfillment_note,
            created_at:     airtimeOrder.created_at,
            updated_at:     airtimeOrder.updated_at,
        })
    }

    logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'GET', statusCode: 404, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Order not found' })
    return apiError(404, `No order found with reference: ${reference}. Bill payments are at /api/v2/utilities/orders/${reference}.`)
}
