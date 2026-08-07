import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { fetchSupplierBalance } from '@/lib/fulfillment-service'

const CACHE_DURATION = 300000 // 5 minutes in milliseconds

type SupplierResult = { success: boolean; balance?: number; currency?: string; error?: string }

// Response payload, built once and reused for the cached replay so the two can't drift.
type BalancePayload = Record<string, number | string | boolean | undefined>

let balanceCache: { payload: BalancePayload; timestamp: number } | null = null

/**
 * Flatten one supplier's result into the response.
 * A FAILED fetch must NOT be reported as `0` — the admin card would then show
 * "GHS 0.00", which is indistinguishable from a genuinely empty wallet and hides
 * the real cause (missing API key, 401, supplier down). Failures are sent as
 * `<prefix>_error` with no balance/currency, and the UI renders "Unavailable".
 */
function flatten(prefix: string | null, result: SupplierResult): BalancePayload {
    const key = (suffix: string) => (prefix ? `${prefix}_${suffix}` : suffix)
    if (!result.success) {
        // DataKazina's balance/currency are unprefixed for backwards compatibility, but its
        // error is still namespaced — a bare `error` on a 200 response would look like a
        // whole-request failure to any client.
        return { [prefix ? key('error') : 'dakazina_error']: result.error || 'Failed to fetch balance' }
    }
    return {
        [key('balance')]: result.balance ?? 0,
        [key('currency')]: result.currency || 'GHS',
    }
}

export async function GET() {
    try {
        // 1. Authenticate user
        const cookieStore = await cookies()
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Verify admin role
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        // 3. Check Cache
        const now = Date.now()
        if (balanceCache && (now - balanceCache.timestamp < CACHE_DURATION)) {
            console.log('[Fulfillment Balance] Returning cached balances')
            return NextResponse.json({ ...balanceCache.payload, cached: true })
        }

        // 4. Fetch balances from all suppliers in parallel
        const { fetchSupplierBalance: fetchCodeCraftBalance } = await import('@/lib/codecraft-service')
        const { fetchSupplierBalance: fetchKingFlexyBalance } = await import('@/lib/kingflexy-service')
        const { fetchSupplierBalance: fetchEazyDataBalance } = await import('@/lib/eazydata-service')
        const { fetchSupplierBalance: fetchAgentPortalBalance } = await import('@/lib/agentportal-service')
        const { fetchSupplierBalance: fetchNetPulseBalance } = await import('@/lib/netpulse-service')

        const [dakazinaResult, codecraftResult, kingflexyResult, eazydataResult, agentportalResult, netpulseResult] = await Promise.all([
            fetchSupplierBalance(),
            fetchCodeCraftBalance(),
            fetchKingFlexyBalance(),
            fetchEazyDataBalance(),
            fetchAgentPortalBalance(),
            fetchNetPulseBalance()
        ])

        const results: Array<[string | null, SupplierResult]> = [
            [null, dakazinaResult],
            ['codecraft', codecraftResult],
            ['kingflexy', kingflexyResult],
            ['eazydata', eazydataResult],
            ['agentportal', agentportalResult],
            ['netpulse', netpulseResult],
        ]

        for (const [prefix, result] of results) {
            if (!result.success) {
                console.error(`[Fulfillment Balance] ${prefix || 'dakazina'} balance fetch failed: ${result.error}`)
            }
        }

        if (results.every(([, result]) => !result.success)) {
            return NextResponse.json({ error: 'Failed to fetch balances from all suppliers' }, { status: 500 })
        }

        const payload: BalancePayload = Object.assign({}, ...results.map(([prefix, result]) => flatten(prefix, result)))

        // 5. Update Cache — only when every supplier answered. Caching a partial read
        // would keep an outage (or a missing API key) on screen for a further 5 minutes
        // even after it is fixed, and Refresh would appear to do nothing.
        if (results.every(([, result]) => result.success)) {
            balanceCache = { payload, timestamp: now }
        } else {
            balanceCache = null
        }

        return NextResponse.json({ ...payload, cached: false })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
