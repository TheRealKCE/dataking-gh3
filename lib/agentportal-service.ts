import { sanitizeForLog } from '@/lib/safe-log'

// Agent Portal GH Fulfillment Service — mirrors lib/eazydata-service.ts architecture.
// API Docs: https://api.agentportalgh.com  (see "Agent API" reference)
//
// IMPORTANT — this supplier is ASYNCHRONOUS / QUEUE-BASED and differs from the others:
//   • POST /api/queue/add returns only { added, charged, balance } — NO transaction id.
//     We correlate results using the `reference` WE supply (the Arhms order id).
//   • Completion is delivered via a signed webhook (order.completed) handled in
//     app/api/webhooks/agentportal/route.ts. checkOrderStatus() here is a best-effort
//     poll used only by the fallback reconciliation cron.

const AGENTPORTAL_API_KEY = process.env.AGENTPORTAL_API_KEY || ''
const AGENTPORTAL_API_URL = process.env.AGENTPORTAL_API_URL || 'https://api.agentportalgh.com'

// ─── Circuit Breaker ───────────────────────────────────────────────────────────
let circuitState: 'closed' | 'open' | 'half-open' = 'closed'
let failureCount = 0
let lastFailureTime: number | null = null
const FAILURE_THRESHOLD = 5
const RECOVERY_TIMEOUT = 60000 // 1 minute

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface FulfillmentResponse {
    success: boolean
    reference?: string
    transactionId?: string
    error?: string
    apiResponse?: any
    isRateLimited?: boolean
    alreadySubmitted?: boolean
    // True when the order was rejected because the MTN number isn't enabled on the
    // account yet (whitelist gate). Agent Portal auto-submits it to MTN for enabling
    // (~24h); the order is kept pending and the auto-refulfill cron retries it later.
    whitelistPending?: boolean
}

interface StatusResponse {
    success: boolean
    status: 'pending' | 'processing' | 'completed' | 'failed'
    message?: string
    data?: any
}

// ─── Per-network GB windows (from Agent Portal docs) ────────────────────────────
// service code → { min, max } whole-GB bundle window.
const SERVICE_WINDOWS: Record<string, { service: string; min: number; max: number }> = {
    MTN: { service: 'mtn', min: 1, max: 200 },
    Telecel: { service: 'telecel', min: 10, max: 200 },
    'AT-iShare': { service: 'airteltigo', min: 1, max: 200 },
    'AT-BigTime': { service: 'airteltigo', min: 1, max: 200 },
}

// ─── Circuit Breaker Helpers ──────────────────────────────────────────────────
function checkCircuit(): boolean {
    if (circuitState === 'closed') return true
    if (circuitState === 'open') {
        const now = Date.now()
        if (lastFailureTime && now - lastFailureTime > RECOVERY_TIMEOUT) {
            circuitState = 'half-open'
            return true
        }
        return false
    }
    return true // half-open allows one attempt
}

function recordSuccess() {
    failureCount = 0
    circuitState = 'closed'
}

function recordFailure() {
    failureCount++
    lastFailureTime = Date.now()
    if (failureCount >= FAILURE_THRESHOLD) {
        circuitState = 'open'
        console.log('[AgentPortal] Circuit breaker OPENED')
    }
}

// ─── Network Resolver ──────────────────────────────────────────────────────────
/**
 * Map an internal Arhms network name to Agent Portal's `service` code + GB window.
 * Internal names: "MTN", "Telecel", "AT-iShare", "AT-BigTime".
 * Agent Portal services: "mtn", "telecel", "airteltigo".
 */
function resolveService(network: string): { service: string; min: number; max: number } | null {
    if (SERVICE_WINDOWS[network]) return SERVICE_WINDOWS[network]
    // Loose fallbacks for slight naming variations.
    const n = (network || '').toUpperCase()
    if (n.startsWith('AT')) return SERVICE_WINDOWS['AT-iShare']
    if (n === 'TELECEL' || n === 'VODAFONE') return SERVICE_WINDOWS['Telecel']
    if (n.startsWith('MTN')) return SERVICE_WINDOWS['MTN']
    return null
}

// ─── Main Fulfillment Function ─────────────────────────────────────────────────
/**
 * Fulfill a data order via Agent Portal GH.
 * POST /api/queue/add with { service, items: [{ msisdn, data_gb, reference }] }.
 * The wallet is charged atomically on submit; the item is then batched into an
 * order and delivered asynchronously (completion arrives via webhook).
 * `reference` is set to the Arhms orderId so the webhook can be matched back.
 */
export async function fulfillOrder(
    network: string,
    phoneNumber: string,
    dataSize: string,
    orderId: string
): Promise<FulfillmentResponse> {

    if (!checkCircuit()) {
        console.warn(`[AgentPortal] Circuit breaker is OPEN. Order ${orderId} kept pending.`)
        return { success: false, error: 'Service temporarily unavailable (circuit open)' }
    }

    if (!AGENTPORTAL_API_KEY) {
        return { success: false, error: 'AgentPortal API key not configured' }
    }

    try {
        // ── Resolve network → service + GB window ───────────────────────────
        const svc = resolveService(network)
        if (!svc) {
            return { success: false, error: `Unsupported network: ${network}` }
        }

        // ── Parse whole-GB volume (decimals rejected by the supplier) ───────
        const sizeMatch = dataSize.match(/[\d.]+/)
        if (!sizeMatch) {
            return { success: false, error: `Invalid data size format: ${dataSize}` }
        }
        const gigVolume = Number(sizeMatch[0])
        if (isNaN(gigVolume) || gigVolume <= 0) {
            return { success: false, error: `Invalid GB volume parsed from: ${dataSize}` }
        }
        if (!Number.isInteger(gigVolume)) {
            // Agent Portal only accepts whole-GB bundles.
            return { success: false, error: `AgentPortal accepts whole-GB bundles only (got ${gigVolume}GB for ${network})` }
        }
        if (gigVolume < svc.min || gigVolume > svc.max) {
            return { success: false, error: `${svc.service} accepts ${svc.min}–${svc.max} GB — ${gigVolume}GB is out of range` }
        }

        // ── Phone Normalization → 0XXXXXXXXX (10-digit Ghana) ───────────────
        let normalizedPhone = phoneNumber.replace(/\s+/g, '').replace(/-/g, '')
        if (normalizedPhone.startsWith('233')) normalizedPhone = '0' + normalizedPhone.slice(3)
        else if (!normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone

        const requestBody = {
            service: svc.service,
            items: [
                { msisdn: normalizedPhone, data_gb: gigVolume, reference: orderId },
            ],
        }

        console.log(`[AgentPortal] Order ${orderId} | ${svc.service} | ${gigVolume}GB | recipient: ${normalizedPhone}`)
        console.log(`[AgentPortal] Request payload:`, sanitizeForLog(requestBody))

        // ── HTTP Fetch with 3-retry logic (network errors only) ─────────────
        let response: Response | null = null
        let attempt = 0
        const maxAttempts = 3
        let lastError: Error | null = null

        while (attempt < maxAttempts) {
            attempt++
            try {
                response = await fetch(`${AGENTPORTAL_API_URL}/api/queue/add`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-API-Key': AGENTPORTAL_API_KEY,
                    },
                    body: JSON.stringify(requestBody),
                })

                if (response.status === 429) {
                    console.warn(`[AgentPortal] Rate limited (HTTP 429). Order ${orderId} kept pending.`)
                    return { success: false, error: 'Supplier Rate Limited (429)', isRateLimited: true }
                }

                break

            } catch (err: any) {
                lastError = err
                console.error(`[AgentPortal] Fetch error on attempt ${attempt}:`, err.message)
                if (attempt < maxAttempts) {
                    const delay = 2000 * attempt
                    console.log(`[AgentPortal] Retrying in ${delay}ms...`)
                    await new Promise(res => setTimeout(res, delay))
                }
            }
        }

        if (!response) {
            recordFailure()
            return { success: false, error: lastError?.message || 'Persistent network error connecting to AgentPortal' }
        }

        // ── Parse JSON ─────────────────────────────────────────────────────
        const rawText = await response.text()
        let data: any
        try {
            data = JSON.parse(rawText)
        } catch (e) {
            console.error(`[AgentPortal] Non-JSON response (HTTP ${response.status}):`, rawText.slice(0, 300))
            recordFailure()
            return { success: false, error: `Supplier returned unexpected response format (HTTP ${response.status})` }
        }

        console.log(`[AgentPortal] API response:`, { status: response.status, added: data?.added })

        // ── Success: { added: >=1, charged, balance } ───────────────────────
        if (response.ok && typeof data?.added === 'number' && data.added >= 1) {
            recordSuccess()
            return {
                success: true,
                reference: orderId,
                transactionId: orderId, // no supplier id — we correlate by our own reference
                apiResponse: sanitizeForLog(data),
            }
        }

        // ── Whitelist gate: added: 0 with a `rejected` array (no charge) ─────
        // The MTN number isn't enabled yet — keep the order PENDING (not processing).
        if (response.ok && data?.added === 0) {
            const reason = Array.isArray(data?.rejected) && data.rejected[0]?.reason
                ? data.rejected[0].reason
                : 'number not enabled on MTN yet'
            // The whitelist/verification gate is MTN-only — only flag whitelistPending
            // (which triggers the customer verification SMS) for MTN orders.
            const isMtn = svc.service === 'mtn'
            console.warn(`[AgentPortal] Order ${orderId} not enqueued (added: 0): ${reason}.${isMtn ? ' Number auto-submitted to MTN for verification (~24h).' : ''} Kept pending.`)
            return { success: false, error: reason, whitelistPending: isMtn, apiResponse: sanitizeForLog(data) }
        }

        // ── Error responses: { error: "message" } ───────────────────────────
        const errMsg = data?.error || 'Unknown error'

        // 402 insufficient balance — supplier is up, don't trip the breaker.
        if (response.status === 402) {
            console.error(`[AgentPortal] Order ${orderId}: insufficient wallet balance — top up AgentPortal. (${errMsg})`)
            return { success: false, error: errMsg, apiResponse: sanitizeForLog(data) }
        }

        // 401 auth error — misconfigured key, supplier is up.
        if (response.status === 401) {
            console.error(`[AgentPortal] Order ${orderId}: authentication error — check AGENTPORTAL_API_KEY. (${errMsg})`)
            return { success: false, error: errMsg, apiResponse: sanitizeForLog(data) }
        }

        console.warn(`[AgentPortal] Order ${orderId} not fulfilled: ${errMsg} (HTTP ${response.status}). Kept pending.`)
        if (response.status >= 500) {
            recordFailure()
        }
        return {
            success: false,
            error: errMsg,
            apiResponse: sanitizeForLog(data),
        }

    } catch (error: any) {
        recordFailure()
        console.error(`[AgentPortal] Exception during fulfillOrder for ${orderId}:`, error.message)
        return { success: false, error: error.message || 'Unexpected exception' }
    }
}

// ─── Order Status Check (fallback reconciliation only) ──────────────────────────
/**
 * Best-effort status lookup for the fallback cron. Agent Portal has no
 * status-by-reference endpoint, so we scan today's (and yesterday's) orders and
 * match the item whose `reference` equals ours.
 * `reference` is the Arhms orderId we sent at fulfillment time.
 */
export async function checkOrderStatus(reference: string): Promise<StatusResponse> {

    if (!checkCircuit()) return { success: false, status: 'pending', message: 'Service unavailable (circuit open)' }
    if (!AGENTPORTAL_API_KEY) return { success: false, status: 'pending', message: 'API key not configured' }

    try {
        // Look back over the last 2 days of orders to find the group containing our item.
        const dates: string[] = []
        for (let i = 0; i < 2; i++) {
            const d = new Date(Date.now() - i * 86400000)
            dates.push(d.toISOString().slice(0, 10)) // YYYY-MM-DD
        }

        for (const date of dates) {
            const listResp = await fetch(`${AGENTPORTAL_API_URL}/api/beneficiaries/orders?date=${date}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'X-API-Key': AGENTPORTAL_API_KEY },
            })

            const listText = await listResp.text()
            let listData: any
            try {
                listData = JSON.parse(listText)
            } catch {
                continue
            }

            const orders: any[] = Array.isArray(listData) ? listData : (listData?.data || [])
            for (const grp of orders) {
                const orderId = grp?.id || grp?.order_id
                if (!orderId) continue

                const itemsResp = await fetch(
                    `${AGENTPORTAL_API_URL}/api/beneficiaries/orders/${encodeURIComponent(orderId)}/items`,
                    { method: 'GET', headers: { 'Accept': 'application/json', 'X-API-Key': AGENTPORTAL_API_KEY } }
                )
                const itemsText = await itemsResp.text()
                let itemsData: any
                try {
                    itemsData = JSON.parse(itemsText)
                } catch {
                    continue
                }

                const items: any[] = Array.isArray(itemsData) ? itemsData : (itemsData?.data || itemsData?.items || [])
                const match = items.find((it: any) => it?.reference === reference)
                if (match) {
                    recordSuccess()
                    return {
                        success: true,
                        status: mapAgentPortalStatus(match.status),
                        message: match.status,
                        data: match,
                    }
                }
            }
        }

        // Not found yet — still in flight.
        return { success: false, status: 'pending', message: 'Order item not found in recent orders' }

    } catch (error) {
        recordFailure()
        return { success: false, status: 'pending', message: 'Connection error during status check' }
    }
}

// Agent Portal per-item statuses: 'success' | 'failed' (terminal). Anything else → processing.
function mapAgentPortalStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const s = (status || '').toLowerCase()
    if (s === 'success' || s === 'done' || s === 'completed' || s === 'delivered') return 'completed'
    if (s === 'failed' || s === 'cancelled' || s === 'reversed') return 'failed'
    return 'processing'
}

// ─── Batch Status Fetch (for the reconciliation cron) ───────────────────────────
/**
 * Fetch the status of every item across the last 2 days of Agent Portal orders in a
 * SINGLE pass, returning a Map keyed by the `reference` we submitted (the Arhms order
 * id) → mapped status. The reconciliation cron calls this ONCE per run and then looks
 * up each of its processing orders locally — far cheaper than scanning per order.
 *
 * `success` is false only when we couldn't reach the supplier at all (so the cron can
 * bail without mistakenly treating an empty map as "everything still pending").
 */
export async function fetchRecentItemStatuses(): Promise<{
    success: boolean
    statuses: Map<string, 'pending' | 'processing' | 'completed' | 'failed'>
    error?: string
}> {
    const statuses = new Map<string, 'pending' | 'processing' | 'completed' | 'failed'>()

    if (!checkCircuit()) return { success: false, statuses, error: 'Service unavailable (circuit open)' }
    if (!AGENTPORTAL_API_KEY) return { success: false, statuses, error: 'API key not configured' }

    // Last 2 calendar days (covers same-day + overnight verification turnarounds).
    const dates: string[] = []
    for (let i = 0; i < 2; i++) {
        dates.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10))
    }

    let reachedSupplier = false

    try {
        for (const date of dates) {
            const listResp = await fetch(`${AGENTPORTAL_API_URL}/api/beneficiaries/orders?date=${date}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'X-API-Key': AGENTPORTAL_API_KEY },
            })

            const listText = await listResp.text()
            let listData: any
            try {
                listData = JSON.parse(listText)
            } catch {
                continue // non-JSON (WAF/HTML) — skip this date
            }
            reachedSupplier = true

            const orders: any[] = Array.isArray(listData) ? listData : (listData?.data || [])
            for (const grp of orders) {
                const orderId = grp?.id || grp?.order_id
                if (!orderId) continue

                // Light pre-filter: skip groups that haven't done anything terminal yet
                // (still uploading, nothing succeeded or failed) to save an items call.
                const ps = String(grp?.processing_status || '').toUpperCase()
                const success = Number(grp?.success_count) || 0
                const failure = Number(grp?.failure_count) || 0
                if (ps !== 'DONE' && success === 0 && failure === 0) continue

                // Fetch the group's items. Agent Portal splits each order into rows: the
                // "uploaded" row carries OUR `reference`; the delivered row has the terminal
                // status (success/failed) but a null reference. So take the reference from
                // whichever row has it, and the outcome from the terminal rows.
                const itemsResp = await fetch(
                    `${AGENTPORTAL_API_URL}/api/beneficiaries/orders/${encodeURIComponent(orderId)}/items`,
                    { method: 'GET', headers: { 'Accept': 'application/json', 'X-API-Key': AGENTPORTAL_API_KEY } }
                )
                const itemsText = await itemsResp.text()
                let itemsData: any
                try {
                    itemsData = JSON.parse(itemsText)
                } catch {
                    continue
                }

                const items: any[] = Array.isArray(itemsData) ? itemsData : (itemsData?.data || itemsData?.items || [])

                // The reference we submitted (lives on the row that still has it).
                const ourRef = items.find((it: any) => it?.reference)?.reference
                if (!ourRef) continue

                // Terminal outcome:
                //  • success is always terminal → completed.
                //  • a failed row is only FINAL when non-retriable — i.e. auto-refunded
                //    (refunded_at set). A failed row without refunded_at may still be
                //    retried, so we WAIT (leave the order processing) rather than mark it
                //    failed prematurely during Agent Portal's retry window.
                const hasSuccess = items.some((it: any) => String(it?.status || '').toLowerCase() === 'success')
                const hasTerminalFailure = items.some((it: any) =>
                    String(it?.status || '').toLowerCase() === 'failed' && it?.refunded_at)

                if (hasSuccess) {
                    statuses.set(String(ourRef), 'completed')
                } else if (hasTerminalFailure) {
                    statuses.set(String(ourRef), 'failed')
                }
                // else: still in-flight / retriable — leave as processing.
            }
        }

        if (!reachedSupplier) {
            recordFailure()
            return { success: false, statuses, error: 'Could not reach Agent Portal' }
        }

        recordSuccess()
        return { success: true, statuses }
    } catch (error: any) {
        recordFailure()
        return { success: false, statuses, error: error?.message || 'Connection error during batch status fetch' }
    }
}

// ─── Balance Fetch ─────────────────────────────────────────────────────────────
/**
 * Fetch live Agent Portal wallet balance.
 * GET /api/wallet → { balance, transactions_total, recent_transactions }.
 */
export async function fetchSupplierBalance(): Promise<{
    success: boolean
    balance?: number
    currency?: string
    error?: string
}> {
    try {
        const response = await fetch(`${AGENTPORTAL_API_URL}/api/wallet`, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'X-API-Key': AGENTPORTAL_API_KEY },
        })

        const rawText = await response.text()
        let data: any
        try {
            data = JSON.parse(rawText)
        } catch (e) {
            console.error('[AgentPortal Balance] Non-JSON response (HTTP', response.status, '):', rawText.slice(0, 300))
            return { success: false, error: `Unexpected response format (HTTP ${response.status})` }
        }

        console.log('[AgentPortal Balance] API response received', { status: response.status, ok: response.ok })

        if (response.ok && data?.balance !== undefined) {
            const balance = parseFloat(data.balance ?? 0) || 0
            return { success: true, balance, currency: 'GHS' }
        }

        return { success: false, error: data?.error || 'Failed to fetch balance' }

    } catch (error: any) {
        console.error('[AgentPortal Balance] Error:', error)
        return { success: false, error: error.message }
    }
}

// ─── MTN Whitelist Verify / Submit ──────────────────────────────────────────────
/**
 * Check which MTN numbers are enabled ("whitelisted") on the account, and — as a side
 * effect of the same endpoint — auto-submit any that aren't yet for enabling (~24h).
 * POST /api/mtn-whitelist/verify { msisdns: [...] } → { results: [{ input, normalized, allowed }] }.
 * Returns the set of ENABLED numbers (both input and normalized forms) so callers can
 * match regardless of phone format. Up to 1000 numbers per call.
 */
export async function verifyMtnWhitelist(msisdns: string[]): Promise<{
    success: boolean
    allowed: Set<string>
    error?: string
}> {
    const allowed = new Set<string>()
    if (!AGENTPORTAL_API_KEY) return { success: false, allowed, error: 'API key not configured' }
    if (!msisdns || msisdns.length === 0) return { success: true, allowed }

    try {
        const response = await fetch(`${AGENTPORTAL_API_URL}/api/mtn-whitelist/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-API-Key': AGENTPORTAL_API_KEY,
            },
            body: JSON.stringify({ msisdns: msisdns.slice(0, 1000) }),
        })

        const rawText = await response.text()
        let data: any
        try {
            data = JSON.parse(rawText)
        } catch {
            return { success: false, allowed, error: `Unexpected response (HTTP ${response.status})` }
        }

        if (response.ok && Array.isArray(data?.results)) {
            for (const r of data.results) {
                if (r?.allowed === true) {
                    if (r.normalized) allowed.add(String(r.normalized))
                    if (r.input) allowed.add(String(r.input))
                }
            }
            return { success: true, allowed }
        }

        return { success: false, allowed, error: data?.error || `Failed to verify (HTTP ${response.status})` }
    } catch (error: any) {
        console.error('[AgentPortal Whitelist] Error:', error)
        return { success: false, allowed, error: error?.message || 'Connection error' }
    }
}
