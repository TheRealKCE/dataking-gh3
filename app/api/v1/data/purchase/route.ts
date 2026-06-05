import { NextRequest } from 'next/server'
import {
    validateApiKey, isApiError, apiSuccess, apiError,
    logApiRequest, getClientIp,
} from '@/lib/api-auth'
import { sendPushToAdmins } from '@/lib/web-push'
import { generateReferenceCode } from '@/lib/utils'

const ENDPOINT = '/api/v1/data/purchase'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = getClientIp(request)

    const auth = await validateApiKey(request)
    if (isApiError(auth)) {
        logApiRequest({ apiKeyId: null, userId: null, endpoint: ENDPOINT, method: 'POST', statusCode: (auth as any).status, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Auth failed' })
        return auth
    }

    const { userId, apiKeyId, userRole, supabase } = auth

    let body: any
    try { body = await request.json() } catch {
        return apiError(400, 'Invalid JSON body')
    }

    const { network, volume_gb, recipient, reference: clientRef } = body

    if (!network || !volume_gb || !recipient) {
        return apiError(400, 'network, volume_gb, and recipient are required')
    }

    const cleanPhone = String(recipient).replace(/\s+/g, '')
    if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) {
        return apiError(400, 'Invalid recipient phone. Use Ghana format: 0XXXXXXXXX or 233XXXXXXXXX')
    }

    if (!['MTN', 'Telecel', 'AT'].includes(network)) {
        return apiError(400, 'Invalid network. Must be one of: MTN, Telecel, AT')
    }

    // Idempotency on client-supplied reference
    if (clientRef) {
        const { data: existing } = await (supabase.from('orders') as any)
            .select('id, reference_code, status, size, network')
            .eq('reference_code', clientRef)
            .eq('api_key_id', apiKeyId)
            .maybeSingle()

        if (existing) {
            logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 200, responseTimeMs: Date.now() - startTime, ip })
            return apiSuccess({
                order_id: existing.id,
                reference: existing.reference_code,
                status: existing.status,
                network: existing.network,
                size: existing.size,
                recipient: cleanPhone,
            }, { cached: true })
        }
    }

    // Find matching package
    const sizeQuery = String(volume_gb).replace(/gb/i, '').trim()
    const { data: packages } = await (supabase.from('data_packages') as any)
        .select('id, network, size, price, agent_price, cost_price, is_available')
        .eq('network', network)
        .eq('is_available', true)

    const pkg = (packages || []).find((p: any) =>
        p.size.toLowerCase().replace(/\s+/g, '').includes(sizeQuery.toLowerCase())
    )

    if (!pkg) {
        return apiError(404, `No available package found for ${network} ${volume_gb}.`)
    }

    // Pricing: agent price if active agent, else retail
    const { data: userExpiry } = await supabase
        .from('users')
        .select('agent_expires_at')
        .eq('id', userId)
        .single()

    const agentExpired = (userExpiry as any)?.agent_expires_at
        && new Date((userExpiry as any).agent_expires_at) < new Date()
    const isActiveAgent = userRole === 'agent' && !agentExpired
    const priceToCharge = isActiveAgent && pkg.agent_price > 0 ? pkg.agent_price : pkg.price

    // Atomic wallet deduction
    const { data: deductResult, error: deductError } = await (supabase as any).rpc('deduct_wallet_balance', {
        p_user_id: userId,
        p_amount: priceToCharge,
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

    if (!walletId) {
        return apiError(404, 'Wallet not found')
    }

    const referenceCode = clientRef || generateReferenceCode()

    // Create order
    const { data: order, error: orderError } = await (supabase.from('orders') as any)
        .insert({
            user_id:            userId,
            phone_number:       cleanPhone,
            network:            pkg.network,
            size:               pkg.size,
            price:              priceToCharge,
            cost_price_at_time: pkg.cost_price || 0,
            role_at_time:       userRole,
            status:             'pending',
            payment_status:     'paid',
            reference_code:     referenceCode,
            fulfillment_method: 'auto',
            source:             'api',
            api_key_id:         apiKeyId,
        })
        .select()
        .single()

    if (orderError) {
        await (supabase as any).rpc('credit_wallet_balance', { p_user_id: userId, p_amount: priceToCharge }).catch(() => {})
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 500, responseTimeMs: Date.now() - startTime, ip, errorMessage: orderError.message })
        return apiError(500, 'Failed to create order')
    }

    // Wallet transaction record (fire-and-forget — non-critical)
    ;(supabase.from('wallet_transactions') as any).insert({
        wallet_id:   walletId,
        user_id:     userId,
        type:        'debit',
        amount:      priceToCharge,
        description: `API: ${pkg.network} ${pkg.size} → ${cleanPhone}`,
        reference:   referenceCode,
        source:      'api_purchase',
        status:      'completed',
    }).then(() => {}).catch(() => {})

    // Notify admins so they can manually process if auto-fulfillment fails (fire-and-forget)
    sendPushToAdmins({
        title: 'New API Order',
        body: `API: ${pkg.network} ${pkg.size} → ${cleanPhone} (GHS ${priceToCharge.toFixed(2)})`,
        url: '/admin/orders',
    }).catch(() => {})

    // ── Auto-fulfillment (SYNCHRONOUS — must complete before response) ────────
    // Running after response (fire-and-forget) causes Vercel to kill the
    // async work as soon as the HTTP response is sent.
    let fulfillmentStatus: 'pending' | 'processing' = 'pending'
    try {
        const { data: settingsData } = await supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])

        const settingsMap = (settingsData || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value; return acc
        }, {})

        if (String(settingsMap.auto_fulfillment_enabled) !== 'false') {
            let fulfillmentSettings = {
                networks: {} as Record<string, boolean>,
                codecraft_networks: {} as Record<string, boolean>,
            }
            if (settingsMap.fulfillment_settings) {
                try {
                    const parsed = typeof settingsMap.fulfillment_settings === 'string'
                        ? JSON.parse(settingsMap.fulfillment_settings)
                        : settingsMap.fulfillment_settings
                    fulfillmentSettings.networks = parsed?.networks || {}
                    fulfillmentSettings.codecraft_networks = parsed?.codecraft_networks || {}
                } catch { /* ignore — stays as empty, order stays pending */ }
            }

            const isDataKazina = fulfillmentSettings.networks[pkg.network] === true
            const isCodeCraft = fulfillmentSettings.codecraft_networks[pkg.network] === true

            // Only attempt if exactly one supplier is active for this network
            if ((isDataKazina || isCodeCraft) && !(isDataKazina && isCodeCraft)) {
                let result: { success: boolean; transactionId?: string; reference?: string; error?: string }

                if (isCodeCraft) {
                    const { fulfillOrder } = await import('@/lib/codecraft-service')
                    result = await fulfillOrder(pkg.network, cleanPhone, pkg.size, (order as any).id)
                } else {
                    const { fulfillOrder } = await import('@/lib/fulfillment-service')
                    result = await fulfillOrder(pkg.network, cleanPhone, pkg.size, (order as any).id)
                }

                if (result.success) {
                    const supplierLabel = isCodeCraft ? 'codecraft' : 'datakazina'
                    const orderUpdate: Record<string, any> = {
                        status: 'processing',
                        fulfillment_method: supplierLabel,
                        updated_at: new Date().toISOString(),
                    }
                    if (result.transactionId || result.reference) {
                        if (isCodeCraft) orderUpdate.codecraft_reference = result.transactionId || result.reference
                        else orderUpdate.dakazina_reference = result.transactionId || result.reference
                    }
                    await (supabase.from('orders') as any).update(orderUpdate).eq('id', (order as any).id)
                    fulfillmentStatus = 'processing'
                } else {
                    console.error(`[v1/purchase] Fulfillment failed for ${(order as any).id}: ${result.error}`)
                }
            }
        }
    } catch (e) {
        console.error('[v1/purchase] Fulfillment error:', e)
    }

    logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode: 201, responseTimeMs: Date.now() - startTime, ip })

    return apiSuccess({
        order_id:       (order as any).id,
        reference:      referenceCode,
        status:         fulfillmentStatus,
        network:        pkg.network,
        size:           pkg.size,
        recipient:      cleanPhone,
        amount_charged: priceToCharge,
        wallet_balance: newBalance,
    })
}
