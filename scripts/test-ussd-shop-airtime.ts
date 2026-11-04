/**
 * Test: a shop's airtime, and its bills, on the USSD short-code menu
 * (app/api/hubtel/interact, lib/ussd-airtime.ts quoteShopAirtime, lib/ussd-shop-airtime-fulfillment.ts)
 *
 * Drives the real POST handler as a caller who is NOT a main-site user, with an in-memory
 * Supabase and a stubbed Paystack. Pins:
 *
 *   - a shop lists Airtime only once its owner has priced a network (airtime_fee_<net> > 0),
 *     and not while the storefront airtime switch is off;
 *   - only the priced networks are sold: an unpriced network is refused before the amount;
 *   - the total is the storefront processor's own arithmetic — amount + amount × (shop fee +
 *     platform fee for the OWNER's role) — so settlement accepts the payment, and the
 *     storefront's 10% fee cap is applied;
 *   - confirming re-prices, writes NO wallet_payments row, and charges exactly the total under a
 *     USSD-SAIR- reference (never USSD-AIR-, which the member settler would claim);
 *   - a 'sair' payment settles through processShopOrder as exact-amount shop airtime;
 *   - Utilities are listed only for a shop that switched bills on AND set a margin above 0.
 *
 * No network, no database.
 *
 * Run (CommonJS is required for the require() hook below):
 *
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *     npx ts-node --transpile-only scripts/test-ussd-shop-airtime.ts
 *
 * Exit code: 0 = all pass, 1 = any fail
 */
import Module from 'module'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..')
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://stub.local'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_stub'

type Row = Record<string, any>
let tables: Record<string, Row[]> = {}

function builder(table: string) {
    const q: any = { op: 'select', filters: [] as Array<(r: Row) => boolean>, payload: null, limit: Infinity }
    const run = async () => {
        const rows = (tables[table] = tables[table] || [])
        const matched = rows.filter((r) => q.filters.every((f: any) => f(r)))
        if (q.op === 'insert') {
            const added = [].concat(q.payload).map((p: any, i: number) => ({ id: `${table}-${rows.length + i + 1}`, ...p }))
            rows.push(...added)
            return { data: added, error: null }
        }
        if (q.op === 'upsert') {
            const p = { ...q.payload }
            const key = table === 'hubtel_sessions' ? 'session_id' : 'id'
            const at = rows.findIndex((r) => r[key] === p[key])
            if (at >= 0) rows[at] = { ...rows[at], ...p }; else rows.push(p)
            return { data: [p], error: null }
        }
        if (q.op === 'update') { matched.forEach((r) => Object.assign(r, q.payload)); return { data: matched, error: null } }
        if (q.op === 'delete') { tables[table] = rows.filter((r) => !matched.includes(r)); return { data: matched, error: null } }
        return { data: matched.slice(0, q.limit), error: null }
    }
    const api: any = {
        select() { return api },
        insert(p: any) { q.op = 'insert'; q.payload = p; return api },
        upsert(p: any) { q.op = 'upsert'; q.payload = p; return api },
        update(p: any) { q.op = 'update'; q.payload = p; return api },
        delete() { q.op = 'delete'; return api },
        // 'data->>key' reads a JSON field, as resolveByReference does.
        eq(c: string, v: any) {
            const [col, field] = c.split('->>')
            q.filters.push((r: Row) => (field ? r[col]?.[field] : r[c]) === v)
            return api
        },
        in(c: string, vs: any[]) { q.filters.push((r: Row) => vs.includes(r[c])); return api },
        not() { return api },
        is(c: string, v: any) { q.filters.push((r: Row) => (r[c] ?? null) === v); return api },
        order() { return api },
        limit(n: number) { q.limit = n; return api },
        single: async () => { const r = await run(); const row = r.data[0]; return row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116' } } },
        maybeSingle: async () => { const r = await run(); return { data: r.data[0] ?? null, error: null } },
        then(res: any, rej: any) { return run().then(res, rej) },
    }
    return api
}
const stubDb = { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) }

const background: Promise<unknown>[] = []
const chargeCalls: any[] = []
const processorCalls: Array<{ reference: string; metadata: any; pesewas: number; slug?: string }> = []
const originalLoad = (Module as any)._load
;(Module as any)._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === '@supabase/supabase-js') return { createClient: () => stubDb }
    if (request === '@vercel/functions') return { waitUntil: (p: Promise<unknown>) => { background.push(p) } }
    if (request === '@/lib/shop-order-processor') {
        return {
            processShopOrder: async (reference: string, metadata: any, pesewas: number, slug?: string) => {
                processorCalls.push({ reference, metadata, pesewas, slug })
                return { success: true, orderId: 'so-1' }
            },
        }
    }
    if (request.startsWith('@/')) return originalLoad.apply(this, [path.join(REPO_ROOT, request.slice(2)), parent, isMain])
    return originalLoad.apply(this, [request, parent, isMain])
}
;(globalThis as any).fetch = async (url: string, init: any) => {
    chargeCalls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    return new Response(JSON.stringify({ status: true, message: 'ok', data: { status: 'pay_offline', reference: 'x', display_text: 'Approve' } }), { status: 200 })
}

// ── Fixtures ────────────────────────────────────────────────────────────────────
const STRANGER = '233209999999'   // not a main-site user, on Telecel
function seed(opts: { settings?: Row[]; shop?: Row; ownerRole?: string } = {}) {
    tables = {
        admin_settings: [
            { key: 'ussd_enabled', value: 'true' },
            { key: 'airtime_fee_mtn_customer', value: '5' }, { key: 'airtime_fee_mtn_agent', value: '3' }, { key: 'airtime_fee_mtn_dealer', value: '2' },
            { key: 'airtime_fee_telecel_customer', value: '5' }, { key: 'airtime_fee_telecel_agent', value: '3' },
            { key: 'airtime_fee_at_customer', value: '5' }, { key: 'airtime_fee_at_agent', value: '3' },
            { key: 'airtime_min_amount', value: '1' }, { key: 'airtime_max_amount', value: '500' },
            { key: 'airtime_enabled_mtn', value: 'true' }, { key: 'airtime_enabled_telecel', value: 'true' }, { key: 'airtime_enabled_at', value: 'true' },
            ...(opts.settings || []),
        ],
        hubtel_sessions: [],
        users: [{ id: 'u-kofi', first_name: 'Kofi', phone_number: '0261111111', role: opts.ownerRole ?? 'agent', status: 'active' }],
        sub_agents: [],
        wallets: [],
        wallet_payments: [],
        shop_profiles: [{
            id: 'sh1', shop_name: 'Kofi Store', shop_slug: 'kofi-store', owner_id: 'u-kofi', ussd_code: 'KOFI', ussd_status: 'active',
            approval_status: 'approved', is_active: true, utilities_enabled: false, utility_fee_percent: 0,
            airtime_fee_mtn: 2, airtime_fee_telecel: 0, airtime_fee_at: 0,
            ...(opts.shop || {}),
        }],
        data_packages: [], results_checker_types: [], shop_afa_pricing: [],
    }
    chargeCalls.length = 0
    processorCalls.length = 0
}
function loadRoute() {
    const p = require.resolve(path.join(REPO_ROOT, 'app/api/hubtel/interact/route.ts'))
    delete require.cache[p]
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(p) as { POST: (req: Request) => Promise<Response> }
}
async function call(route: ReturnType<typeof loadRoute>, body: Record<string, unknown>) {
    const res = await route.POST(new Request('https://arhmsgh.test/api/hubtel/interact', { method: 'POST', body: JSON.stringify(body) }))
    const json: any = await res.json()
    await Promise.allSettled(background.splice(0).filter(Boolean).map((p) => Promise.race([p, new Promise((r) => setTimeout(r, 50))])))
    return json
}
const dial = (r: any, sid: string) => call(r, { Type: 'Initiation', SessionId: sid, Mobile: STRANGER, Operator: 'telecel' })
const say = (r: any, sid: string, text: string) => call(r, { Type: 'Response', SessionId: sid, Mobile: STRANGER, Message: text, Operator: 'telecel' })

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail = '') {
    if (ok) { console.log(`  PASS  ${name}`); passed++ } else { console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`); failed++ }
}

/** Short code, then Airtime (3 when it is the only extra), then the number. */
async function toAmount(r: any, sid: string, phone: string) {
    await dial(r, sid)
    await say(r, sid, 'kofi')
    await say(r, sid, '3')
    return say(r, sid, phone)
}

/** lib/shop-order-processor.ts, airtime branch, exact-amount mode: the figure it will accept. */
function processorExpectedPesewas(amount: number, shopFee: number, adminFee: number): number {
    const feeAmount = amount * ((shopFee + adminFee) / 100)
    return Math.round((amount + feeAmount) * 100)
}

async function main() {
    console.error = () => {}
    console.warn = () => {}

    // ── Listing ─────────────────────────────────────────────────────────────────
    seed({ shop: { airtime_fee_mtn: 0 } }); let r = loadRoute()
    await dial(r, 'l1')
    let out = await say(r, 'l1', 'kofi')
    check('a shop that has priced no network does not list Airtime', /Welcome to Kofi Store/.test(out.Message) && !/Airtime/.test(out.Message), out.Message)

    seed(); r = loadRoute()
    await dial(r, 'l2')
    out = await say(r, 'l2', 'kofi')
    check('a shop that priced MTN lists Airtime under its own name',
        out.Message === 'Welcome to Kofi Store\n1. Data Bundles\n2. Result Checker\n3. Airtime\n0. Exit', JSON.stringify(out.Message))

    seed({ settings: [{ key: 'storefront_airtime_enabled', value: 'false' }] }); r = loadRoute()
    await dial(r, 'l3')
    out = await say(r, 'l3', 'kofi')
    check("storefront_airtime_enabled='false' takes shop airtime off USSD too", !/Airtime/.test(out.Message), out.Message)

    seed({ settings: [{ key: 'ussd_airtime_enabled', value: 'false' }] }); r = loadRoute()
    await dial(r, 'l4')
    out = await say(r, 'l4', 'kofi')
    check("ussd_airtime_enabled='false' takes it off", !/Airtime/.test(out.Message), out.Message)

    // ── Networks ────────────────────────────────────────────────────────────────
    seed(); r = loadRoute()
    out = await toAmount(r, 'n1', '0201234567')
    check('an unpriced network (Telecel) is refused at the number, before any amount',
        /Kofi Store does not sell Telecel airtime/.test(out.Message) && /number to top up/i.test(out.Message), out.Message)
    out = await say(r, 'n1', '0241234567')
    check('  …and a priced one (MTN) goes on to the amount', /^MTN 0241234567\nEnter airtime amount/.test(out.Message), out.Message)

    // ── Price ───────────────────────────────────────────────────────────────────
    seed(); r = loadRoute()
    await toAmount(r, 'p1', '0241234567')
    out = await say(r, 'p1', '10')
    check('shop fee 2% + platform fee for an AGENT owner 3%: GHS 10 airtime, fee 0.50, total 10.50',
        /Confirm Airtime/.test(out.Message) && /Airtime GHS 10\n/.test(out.Message) && /Fee GHS 0\.5\n/.test(out.Message) && /Total GHS 10\.5\n/.test(out.Message), out.Message)

    // The quote must be what the processor will accept, to the pesewa, for any role and amount.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { quoteShopAirtime } = require('@/lib/ussd-airtime')
    const adminFeeFor: Record<string, number> = { agent: 3, customer: 5, dealer: 2, admin: 0 }
    let parityOk = true
    let parityDetail = ''
    for (const role of ['agent', 'customer', 'dealer', 'admin']) {
        for (const shopFee of [0.5, 2, 4.75]) {
            for (const amount of [1, 2.5, 7.33, 10, 99.99, 500]) {
                seed({ ownerRole: role, shop: { airtime_fee_mtn: shopFee } })
                const q = await quoteShopAirtime(stubDb, 'sh1', { phone: '0241234567', network: 'MTN', amount })
                const want = processorExpectedPesewas(amount, shopFee, adminFeeFor[role])
                if (!q.ok || Math.round(q.quote.total * 100) !== want) {
                    parityOk = false
                    parityDetail = `${role} shop ${shopFee}% GHS ${amount}: quote ${JSON.stringify(q)} want ${want}`
                }
            }
        }
    }
    check("every quote equals the processor's expected total (4 roles × 3 shop fees × 6 amounts)", parityOk, parityDetail)

    seed({ shop: { airtime_fee_mtn: 8 } }); r = loadRoute()
    await toAmount(r, 'p2', '0241234567')
    out = await say(r, 'p2', '10')
    check("shop 8% + platform 3% is over the storefront's 10% cap: refused, not charged", /MTN airtime is unavailable/.test(out.Message) && !/Confirm/.test(out.Message), out.Message)

    seed(); r = loadRoute()
    await toAmount(r, 'p3', '0241234567')
    out = await say(r, 'p3', '0.5')
    check('under the minimum is refused', /Minimum is GHS 1\.00/.test(out.Message), out.Message)

    // ── Confirming ──────────────────────────────────────────────────────────────
    seed(); r = loadRoute()
    await toAmount(r, 'c1', '0241234567')
    await say(r, 'c1', '10')
    out = await say(r, 'c1', '1')
    const charge = chargeCalls.find((c) => c.body?.reference)
    check('confirm charges exactly GHS 10.50 under a USSD-SAIR- reference, tagged sair, for the shop',
        !!charge && /^USSD-SAIR-/.test(charge.body.reference) && Number(charge.body.amount) === 1050
        && charge.body.metadata.order_type === 'sair' && charge.body.metadata.shop_id === 'sh1', JSON.stringify(charge?.body))
    check('  …and writes no wallet_payments row (the session is the record, as for shop data)', tables.wallet_payments.length === 0, JSON.stringify(tables.wallet_payments))
    const sess = tables.hubtel_sessions.find((s) => s.session_id === 'c1')
    check('  …with the reference, number, network and amount on the session',
        sess?.data.paystackReference === charge?.body.reference && sess?.data.air.phone === '0241234567' && sess?.data.air.network === 'MTN' && sess?.data.air.amount === 10,
        JSON.stringify(sess?.data))

    seed(); r = loadRoute()
    await toAmount(r, 'd1', '0241234567')
    await say(r, 'd1', '10')
    tables.shop_profiles[0].airtime_fee_mtn = 3
    out = await say(r, 'd1', '1')
    check('a shop fee changed after the total was shown is refused at confirm, uncharged', out.Type === 'Release' && chargeCalls.length === 0, JSON.stringify(out))

    seed(); r = loadRoute()
    await toAmount(r, 'e1', '0241234567')
    await say(r, 'e1', '10')
    tables.admin_settings.push({ key: 'active_payment_provider_ussd', value: 'hubtel' })
    r = loadRoute()
    out = await say(r, 'e1', '1')
    check('the Hubtel rollback rail refuses shop airtime at confirm, uncharged', out.Type === 'Release' && /unavailable/i.test(out.Message) && chargeCalls.length === 0, JSON.stringify(out))

    // ── Settlement ──────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ref = require('@/lib/ussd-reference')
    const sairRef: string = ref.buildUssdReference('sair')
    check("a 'sair' reference is USSD-SAIR-, which the member airtime settler (USSD-AIR-) never claims",
        /^USSD-SAIR-/.test(sairRef) && !sairRef.startsWith('USSD-AIR-'), sairRef)

    seed()
    tables.hubtel_sessions = [{ session_id: 's1', mobile: STRANGER, data: { mode: 'shop', shopId: 'sh1', orderType: 'sair', air: { phone: '0241234567', network: 'MTN', amount: 10 }, paystackReference: 'USSD-SAIR-X' } }]
    const resolved = await ref.ensureUssdSession(stubDb, { sessionId: 's1', orderType: 'sair' })
    check("the webhook resolves the session's order type as 'sair'", resolved?.orderType === 'sair', JSON.stringify(resolved))
    const byRef = await ref.resolveByReference(stubDb, 'USSD-SAIR-X')
    check("  …and so does the sweep, from the reference", byRef?.orderType === 'sair', JSON.stringify(byRef))

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fulfillUssdSession } = require('@/lib/ussd-settle')
    const deferred: Array<() => Promise<void>> = []
    const settled = await fulfillUssdSession({ orderType: 'sair', sessionId: 's1', referenceCode: 'USSD-SAIR-X', amountPaid: 10.5, deferredWork: deferred })
    const pc = processorCalls[0]
    check("a paid 'sair' settles through processShopOrder, once, with the paid pesewas and the shop's slug",
        settled.success === true && processorCalls.length === 1 && pc.reference === 'USSD-SAIR-X' && pc.pesewas === 1050 && pc.slug === 'kofi-store', JSON.stringify({ settled, pc }))
    check('  …as exact-amount shop airtime to the number on the session',
        pc?.metadata.shop_id === 'sh1' && pc.metadata.order_type === 'airtime' && pc.metadata.type === 'airtime' && pc.metadata.use_exact_amount === true
        && pc.metadata.original_amount === 10 && pc.metadata.airtime_amount === 10 && pc.metadata.network === 'MTN' && pc.metadata.guest_phone === '0241234567'
        && pc.metadata.channel === 'ussd', JSON.stringify(pc?.metadata))

    seed()
    tables.hubtel_sessions = [{ session_id: 's2', mobile: STRANGER, data: { mode: 'shop', shopId: 'sh1', orderType: 'sair', air: {} } }]
    const half = await fulfillUssdSession({ orderType: 'sair', sessionId: 's2', referenceCode: 'USSD-SAIR-Y', amountPaid: 10.5, deferredWork: [] })
    check('a session with no number or amount is not settled', half.success === false && processorCalls.length === 0, JSON.stringify(half))

    // ── Utilities need a margin ─────────────────────────────────────────────────
    const utilOn = [{ key: 'ussd_utilities_enabled', value: 'true' }, { key: 'utility_public_launch', value: 'true' }]
    seed({ settings: utilOn, shop: { utilities_enabled: true, utility_fee_percent: 0, airtime_fee_mtn: 0 } }); r = loadRoute()
    await dial(r, 'u1')
    out = await say(r, 'u1', 'kofi')
    check('bills switched on with a 0% margin: Utilities are not listed', !/Utilities/.test(out.Message), out.Message)

    seed({ settings: utilOn, shop: { utilities_enabled: true, utility_fee_percent: 1.5 } }); r = loadRoute()
    await dial(r, 'u2')
    out = await say(r, 'u2', 'kofi')
    check('bills on with a margin set: Airtime then Utilities', /3\. Airtime\n4\. Utilities/.test(out.Message), out.Message)

    seed({ settings: utilOn, shop: { utilities_enabled: false, utility_fee_percent: 1.5 } }); r = loadRoute()
    await dial(r, 'u3')
    out = await say(r, 'u3', 'kofi')
    check('a margin set but bills switched off: not listed', !/Utilities/.test(out.Message), out.Message)

    console.log(`\n${passed} passed, ${failed} failed`)
    process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { process.stderr.write(`${e?.stack || e}\n`); process.exit(1) })
