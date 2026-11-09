/**
 * Test: Kuntanii supplier (lib/kuntanii-service, lib/kuntanii-signature).
 *
 * Offline by default — fetch is stubbed, no network, no DB:
 *   • response → SupplierResult mapping (which failures may fall back)
 *   • status mapping
 *   • retry key probing (<id>, <id>-r1 …): adopt live, replace cancelled
 *   • webhook signature formats
 *
 * With LIVE=1 and KUNTANII_API_KEY set it also calls the two endpoints that never
 * charge — GET /pricing (normal + instant) and POST /beneficiaries/verify — to prove
 * the key works. Pass numbers to verify as VERIFY=0241234567,0551234567.
 *
 * Run:
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *     npx ts-node --transpile-only scripts/test-kuntanii.ts
 *
 * Exit code: 0 = all pass, 1 = any fail
 */

import Module from 'module'
import path from 'path'
import crypto from 'crypto'

const REPO_ROOT = path.resolve(__dirname, '..')
const originalLoad = (Module as any)._load
;(Module as any)._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === '@/lib/web-push') return { sendPushToAdmins: async () => { pushes++ } }
    if (request.startsWith('@/')) return originalLoad.apply(this, [path.join(REPO_ROOT, request.slice(2)), parent, isMain])
    return originalLoad.apply(this, [request, parent, isMain])
}

let pushes = 0
const LIVE = process.env.LIVE === '1'
if (!LIVE) { process.env.KUNTANII_API_KEY = 'kt_live_test'; process.env.KUNTANII_PREVIOUS_API_KEYS = 'kt_live_old' }

// eslint-disable-next-line @typescript-eslint/no-var-requires
const kt = require('../lib/kuntanii-service') as typeof import('../lib/kuntanii-service')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sig = require('../lib/kuntanii-signature') as typeof import('../lib/kuntanii-signature')

let failures = 0
let passes = 0
function check(name: string, cond: boolean, detail?: unknown) {
    if (cond) { passes++; console.log(`  ✓ ${name}`) }
    else { failures++; console.log(`  ✗ ${name}`, detail ?? '') }
}

// ── fetch stub ───────────────────────────────────────────────────────────────
type Call = { method: string; url: string; body?: any; key?: string | null; auth?: string }
let calls: Call[] = []
let router: (c: Call) => { status: number; body: any } | 'throw' = () => ({ status: 500, body: {} })
const realFetch = globalThis.fetch
function stubFetch() {
    ;(globalThis as any).fetch = async (url: string, init: any) => {
        const c: Call = {
            method: init?.method || 'GET', url: String(url),
            body: init?.body ? JSON.parse(init.body) : undefined,
            key: init?.headers?.['X-Kuntanii-Idempotency-Key'] ?? null,
            auth: init?.headers?.Authorization,
        }
        calls.push(c)
        const r = router(c)
        if (r === 'throw') throw new Error('The operation was aborted due to timeout')
        return new Response(JSON.stringify(r.body), { status: r.status })
    }
}

const ID = '3f2b8c1e-1111-4222-8333-944455556666'
const accepted = (ext: string, status = 'pending', extra: any = {}) => ({
    status: 201,
    body: { success: true, outcome: 'accepted', externalOrderId: ext, orderReference: 'KT-1', acceptedCount: 1, rejectedCount: 0, rejectedRecipients: [], status, orders: [{ orderReference: 'KT-1', status }], ...extra },
})

async function offline() {
    console.log('\ninterpretOrderResponse')
    {
        const r = kt.interpretOrderResponse(201, accepted(ID).body, ID)
        check('201 accepted → success, reference = externalOrderId', r.success && r.transactionId === ID && r.reference === ID && !r.alreadySubmitted, r)
        const d = kt.interpretOrderResponse(200, { ...accepted(ID).body, idempotent: true }, ID)
        check('200 idempotent live → alreadySubmitted', d.success && d.alreadySubmitted === true, d)
        const c = kt.interpretOrderResponse(200, { ...accepted(ID, 'cancelled').body, idempotent: true }, ID)
        check('200 idempotent cancelled → cancelledDuplicate, not success', !c.success && c.cancelledDuplicate === true, c)
        const p = kt.interpretOrderResponse(201, { success: true, outcome: 'partially_accepted', acceptedCount: 0, rejectedCount: 1, rejectedRecipients: [{ reason: 'NOT_IN_APPROVED_REGISTRY' }] }, ID)
        check('201 with 0 accepted → refused', !p.success && p.failureKind === 'refused', p)

        const refusedCases: Array<[number, string]> = [
            [422, 'NO_APPROVED_RECIPIENTS'], [422, 'NO_ELIGIBLE_RECIPIENTS'], [422, 'VALIDATION_ERROR'],
            [402, 'INSUFFICIENT_CREDIT'], [402, 'GOVERNING_ACCOUNT_CREDIT_HOLD'], [401, 'UNAUTHORIZED'],
            [403, 'ORDERS_PAUSED'], [403, 'PRICING_PROFILE_REQUIRED'], [503, 'CREDIT_UNAVAILABLE'],
            [503, 'BENEFICIARY_CHECK_UNAVAILABLE'], [429, 'RATE_LIMITED'],
        ]
        for (const [status, code] of refusedCases) {
            const r = kt.interpretOrderResponse(status, { code, message: 'x' }, ID)
            check(`${status} ${code} → refused`, !r.success && r.failureKind === 'refused', r)
        }
        const unknownCases: Array<[number, any]> = [[409, { code: 'CONFLICT' }], [500, { message: 'boom' }], [502, { code: 'SOMETHING' }], [200, null]]
        for (const [status, body] of unknownCases) {
            const r = kt.interpretOrderResponse(status, body, ID)
            check(`${status} ${body?.code || body?.message || 'unparseable'} → unknown (no fallback)`, !r.success && r.failureKind === 'unknown', r)
        }
    }

    console.log('\nmapKuntaniiStatus / overallStatus')
    check('processed → completed', kt.mapKuntaniiStatus('processed') === 'completed')
    check('cancelled → failed', kt.mapKuntaniiStatus('cancelled') === 'failed')
    check('pending → processing', kt.mapKuntaniiStatus('pending') === 'processing')
    check('processing → processing', kt.mapKuntaniiStatus('Processing') === 'processing')
    check('"not received" → pending (never fails an order)', kt.mapKuntaniiStatus('not received') === 'pending')
    check('overall: all processed → completed', kt.overallStatus({ orders: [{ status: 'processed' }, { status: 'processed' }] })?.status === 'completed')
    check('overall: one still processing → not terminal', kt.overallStatus({ orders: [{ status: 'processed' }, { status: 'processing' }] })?.status === 'processing')
    check('uuidFromExternalId strips -rN', kt.uuidFromExternalId(`${ID}-r2`) === ID)

    console.log('\nfulfillOrder')
    stubFetch()
    {
        calls = []
        router = c => accepted(c.body.externalOrderId)
        const r = await kt.fulfillOrder('MTN', '+233241234567', '3GB', ID)
        const sent = calls[0]
        check('live: one POST, key = order id, idempotency header matches', calls.length === 1 && sent.key === ID && sent.body.externalOrderId === ID, calls)
        check('live: phone normalised to 0XXXXXXXXX, dataGb numeric', sent.body.items[0].phoneNumber === '0241234567' && sent.body.items[0].dataGb === 3, sent.body)
        check('live: normal mode sends no deliveryMode', !('deliveryMode' in sent.body))
        check('live: success', r.success && r.transactionId === ID, r)
    }
    {
        calls = []
        router = c => accepted(c.body.externalOrderId)
        await kt.fulfillOrder('MTN', '0241234567', '1GB', ID, { deliveryMode: 'instant' })
        check('instant mode sends deliveryMode: instant', calls[0].body.deliveryMode === 'instant', calls[0].body)
    }
    {
        calls = []
        const r = await kt.fulfillOrder('Telecel', '0201234567', '1GB', ID)
        check('non-MTN refused without calling Kuntanii', !r.success && r.failureKind === 'refused' && calls.length === 0, r)
    }
    {
        calls = []; pushes = 0
        router = () => ({ status: 402, body: { code: 'INSUFFICIENT_CREDIT', message: 'low', retryable: true } })
        const r = await kt.fulfillOrder('MTN', '0241234567', '1GB', ID)
        check('402 → refused + admin push', !r.success && r.failureKind === 'refused' && pushes === 1, { r, pushes })
    }
    {
        calls = []
        router = () => 'throw'
        const r = await kt.fulfillOrder('MTN', '0241234567', '1GB', ID)
        check('timeout → unknown (stays with Kuntanii)', !r.success && r.failureKind === 'unknown', r)
    }
    {
        // Retry: base key is live → adopt, no POST.
        calls = []
        router = c => c.method === 'GET' ? { status: 200, body: { externalOrderId: ID, orders: [{ status: 'processing' }] } } : accepted(ID)
        const r = await kt.fulfillOrder('MTN', '0241234567', '1GB', ID, { isRetry: true })
        check('retry, base live → adopted, no new order', r.success && r.alreadySubmitted === true && calls.every(c => c.method === 'GET'), { r, calls })
    }
    {
        // Retry: base cancelled, -r1 unknown to Kuntanii → POST under -r1.
        calls = []
        router = c => {
            if (c.method === 'GET') return c.url.endsWith(encodeURIComponent(ID)) ? { status: 200, body: { orders: [{ status: 'cancelled' }] } } : { status: 404, body: { code: 'NOT_FOUND' } }
            return accepted(c.body.externalOrderId)
        }
        const r = await kt.fulfillOrder('MTN', '0241234567', '1GB', ID, { isRetry: true })
        const post = calls.find(c => c.method === 'POST')
        check('retry, base cancelled → new order under <id>-r1', !!post && post.key === `${ID}-r1` && r.transactionId === `${ID}-r1`, { r, calls })
    }
    {
        // Retry: base never reached Kuntanii (404) → POST under base key.
        calls = []
        router = c => c.method === 'GET' ? { status: 404, body: {} } : accepted(c.body.externalOrderId)
        const r = await kt.fulfillOrder('MTN', '0241234567', '1GB', ID, { isRetry: true })
        check('retry, base unknown → resend base key', r.success && calls.find(c => c.method === 'POST')?.key === ID, calls)
    }
    {
        // Retry: status check errors → unknown, no POST (can't rule out a live order).
        calls = []
        router = c => c.method === 'GET' ? { status: 500, body: { message: 'down' } } : accepted(ID)
        const r = await kt.fulfillOrder('MTN', '0241234567', '1GB', ID, { isRetry: true })
        check('retry, status check fails → unknown, nothing placed', !r.success && r.failureKind === 'unknown' && !calls.some(c => c.method === 'POST'), { r, calls })
    }
    {
        // Live POST whose key replays as cancelled → hop to -r1 in the same call.
        calls = []
        router = c => c.body.externalOrderId === ID
            ? { status: 200, body: { ...accepted(ID, 'cancelled').body, idempotent: true } }
            : accepted(c.body.externalOrderId)
        const r = await kt.fulfillOrder('MTN', '0241234567', '1GB', ID)
        check('cancelled replay on POST → re-placed under -r1', r.success && r.transactionId === `${ID}-r1` && calls.length === 2, { r, calls })
    }
    {
        // Key change: orders placed with the previous key are 404 under the new one.
        calls = []
        router = c => c.auth === 'Bearer kt_live_old'
            ? { status: 200, body: { externalOrderId: ID, orders: [{ status: 'processed' }] } }
            : { status: 404, body: { code: 'NOT_FOUND' } }
        const st = await kt.checkOrderStatus(ID)
        check('status: 404 on current key → found with previous key', st.success && st.status === 'completed' && calls.length === 2 && calls[0].auth === 'Bearer kt_live_test', { st, calls })
        calls = []
        router = () => ({ status: 404, body: { code: 'NOT_FOUND' } })
        const nf = await kt.checkOrderStatus(ID)
        check('status: 404 on every key → notFound', !nf.success && nf.notFound === true && calls.length === 2, { nf, calls })
        calls = []
        router = () => ({ status: 200, body: { externalOrderId: ID, orders: [{ status: 'processing' }] } })
        await kt.checkOrderStatus(ID)
        check('status: found on current key → previous keys not tried', calls.length === 1)
        calls = []
        router = c => c.method === 'POST' ? accepted(c.body.externalOrderId) : { status: 404, body: {} }
        await kt.fulfillOrder('MTN', '0241234567', '1GB', ID)
        check('orders are placed with the current key only', calls.every(c => c.auth === 'Bearer kt_live_test'), calls)
    }
    ;(globalThis as any).fetch = realFetch

    console.log('\nwebhook signature')
    {
        const secret = 'kt_whsec_test'
        const body = JSON.stringify({ event: 'order.processing', data: { externalOrderId: ID } })
        const hex = crypto.createHmac('sha256', secret).update(body).digest('hex')
        const b64 = crypto.createHmac('sha256', secret).update(body).digest('base64')
        const t = '1767225600'
        const v1 = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
        check('sha256=<hex>', sig.verifyKuntaniiSignature(body, `sha256=${hex}`, secret))
        check('bare hex', sig.verifyKuntaniiSignature(body, hex, secret))
        check('upper-case hex', sig.verifyKuntaniiSignature(body, hex.toUpperCase(), secret))
        check('base64', sig.verifyKuntaniiSignature(body, b64, secret))
        check('t=,v1=', sig.verifyKuntaniiSignature(body, `t=${t},v1=${v1}`, secret))
        check('tampered body rejected', !sig.verifyKuntaniiSignature(body + ' ', `sha256=${hex}`, secret))
        check('wrong secret rejected', !sig.verifyKuntaniiSignature(body, `sha256=${hex}`, 'other'))
        check('missing header rejected', !sig.verifyKuntaniiSignature(body, null, secret))
    }
}

async function live() {
    console.log('\nLIVE (no charge)')
    for (const mode of ['normal', 'instant'] as const) {
        const p = await kt.fetchPricing(mode)
        if (p.success) {
            const plans = (p.data.plans || []).map((x: any) => `${x.bundleSizeMb / 1024}GB=GHS ${x.unitPriceGhs}`).join(', ')
            console.log(`  pricing ${mode}: profile "${p.data.pricingProfileName}" — ${plans || 'no plans'}`)
        } else {
            console.log(`  pricing ${mode}: ${p.error}${'code' in p && p.code ? ` (${p.code})` : ''}`)
        }
        if (mode === 'normal') check('pricing (normal) answers with this key', p.success, p)
    }
    const numbers = (process.env.VERIFY || '').split(',').map(s => s.trim()).filter(Boolean)
    if (numbers.length > 0) {
        const v = await kt.verifyBeneficiaries(numbers)
        check('beneficiaries/verify answers', v.success, v)
        if (v.success) for (const r of v.data.results || []) console.log(`  ${r.phoneNumber}: ${r.reason}`)
    }
}

;(async () => {
    if (LIVE) await live()
    else await offline()
    console.log(`\n${passes} passed, ${failures} failed`)
    process.exit(failures ? 1 : 0)
})()
