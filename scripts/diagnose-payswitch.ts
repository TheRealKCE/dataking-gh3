// @ts-nocheck
/**
 * PaySwitch (TheTeller) Diagnostic
 * Run with: npx tsx scripts/diagnose-payswitch.ts [--charge 233XXXXXXXXX MTN]
 *
 * Two jobs:
 *
 *  1. Confirm credentials and reachability without moving money (default).
 *
 *  2. With --charge, run ONE real debit at GHS 0.10 and print the raw response,
 *     then poll the status endpoint. This is the only way to learn the actual
 *     `code`/`status` values for approved / pending / declined — TheTeller's docs
 *     only publish the approved sample, and PENDING_CODES in
 *     lib/payswitch-payment-service.ts has to be checked against reality before
 *     go-live. Getting it wrong marks live payments failed while the customer is
 *     still entering their PIN.
 *
 * Point PAYSWITCH_BASE_URL at https://test.theteller.net first.
 * Prints no secrets — only credential lengths and status lines.
 */

import * as fs from 'fs'
import * as path from 'path'
import { ProxyAgent, Agent } from 'undici'

// Deliberately no dotenv: it isn't a dependency of this project, and a diagnostic
// you have to install something to run is a diagnostic nobody runs.
for (const file of ['.env.local', '.env']) {
    const p = path.join(__dirname, '..', file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
}

const sep = '─'.repeat(64)
const BASE = (process.env.PAYSWITCH_BASE_URL || 'https://prod.theteller.net').replace(/\/+$/, '')
// Mirror production: PaySwitch goes direct unless PAYSWITCH_USE_PROXY=true, so
// that a diagnostic PASS actually means the live path works.
const useProxy = process.env.PAYSWITCH_USE_PROXY === 'true'
const proxyUrl = useProxy ? (process.env.FIXIE_URL || process.env.QUOTAGUARDSTATIC_URL) : null
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : new Agent()

const SWITCH_MAP = { MTN: 'MTN', Telecel: 'VDF', AT: process.env.PAYSWITCH_AT_SWITCH || 'ATL' }

/** Resolved by probeAuth() before anything else runs. */
let RESOLVED_KEY = process.env.PAYSWITCH_API_KEY

function authHeaderFor(key) {
    const user = process.env.PAYSWITCH_API_USER
    if (!user || !key) return null
    return `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}`
}

function authHeader() {
    return authHeaderFor(RESOLVED_KEY)
}

/**
 * The PaySwitch dashboard shows the API-Key already base64-encoded, while the docs
 * say the header is base64(username:apiKey). So "your API Key" is ambiguous: it
 * could be the string on screen, or that string decoded. Guessing wrong 401s every
 * call, and the two look equally plausible — so try both and let the API decide.
 */
function candidateKeys() {
    const shown = process.env.PAYSWITCH_API_KEY
    if (!shown) return []
    const out = [{ label: 'API-Key exactly as shown in the dashboard', key: shown }]
    try {
        const decoded = Buffer.from(shown, 'base64').toString('utf8')
        // Only a plausible candidate if it round-trips and is printable ASCII.
        if (decoded && /^[\x20-\x7E]+$/.test(decoded) && Buffer.from(decoded).toString('base64') === shown) {
            out.push({ label: 'API-Key base64-DECODED', key: decoded })
        }
    } catch { /* not base64 — the single candidate above is all there is */ }
    return out
}

/** Returns true if this response means "credentials accepted". */
function authAccepted(status) {
    return status !== 401 && status !== 403
}

async function probeAuth() {
    const candidates = candidateKeys()
    console.log('\n' + sep)
    console.log(`Resolving which API-Key form authenticates (${candidates.length} candidate(s))`)
    console.log(sep)

    const working = []
    for (const c of candidates) {
        try {
            const res = await fetch(`${BASE}/v1.1/users/transactions/000000000000/status`, {
                method: 'GET',
                headers: {
                    Authorization: authHeaderFor(c.key),
                    'Merchant-Id': process.env.PAYSWITCH_MERCHANT_ID,
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                },
                signal: AbortSignal.timeout(20_000),
                dispatcher,
            })
            const body = (await res.text()).substring(0, 200)
            const ok = authAccepted(res.status)
            console.log(`  ${ok ? 'ACCEPTED' : 'REJECTED'}  ${c.label}  → HTTP ${res.status}  ${body}`)
            if (ok) working.push(c)
        } catch (err) {
            console.log(`  ERROR     ${c.label}  → ${err?.message} | cause: ${err?.cause?.code || err?.cause?.message || 'n/a'}`)
        }
    }

    if (working.length === 0) {
        console.log('\n  Neither form authenticated. That is either wrong credentials, the wrong')
        console.log('  base URL (test vs prod credentials are NOT interchangeable), or an IP that')
        console.log('  PaySwitch has not whitelisted.')
        return false
    }

    RESOLVED_KEY = working[0].key
    console.log(`\n  → Using: ${working[0].label}`)
    if (working.length > 1) {
        console.log('  (Both were accepted — the probe endpoint may not authenticate at all.')
        console.log('   Treat the --charge result as the real answer.)')
    } else if (working[0].label.includes('DECODED')) {
        console.log('  ACTION: set PAYSWITCH_API_KEY to the DECODED value in .env.local:')
        console.log(`          PAYSWITCH_API_KEY=${working[0].key}`)
    }
    return true
}

function reportConfig() {
    console.log(sep)
    console.log('Configuration')
    console.log(sep)
    console.log('  base URL          :', BASE, BASE.includes('test') ? '(SANDBOX)' : '(LIVE — real money)')
    console.log('  merchant id       :', process.env.PAYSWITCH_MERCHANT_ID ? 'set' : 'MISSING')
    console.log('  api user          :', process.env.PAYSWITCH_API_USER ? `set (${process.env.PAYSWITCH_API_USER.length} chars)` : 'MISSING')
    console.log('  api key           :', process.env.PAYSWITCH_API_KEY ? `set (${process.env.PAYSWITCH_API_KEY.length} chars)` : 'MISSING')
    console.log('  static proxy      :', proxyUrl ? (proxyUrl.split('@')[1] ?? 'configured') : 'none (direct)')
    console.log('  AT r-switch       :', SWITCH_MAP.AT)
}

async function reportEgressIp() {
    try {
        const r = await fetch('https://api.ipify.org?format=json', {
            signal: AbortSignal.timeout(10_000),
            dispatcher,
        })
        const { ip } = await r.json()
        console.log('  egress IP         :', ip, proxyUrl ? '(through proxy — whitelist this)' : '(direct)')
    } catch (err) {
        console.log('  egress IP         : could not determine —', err?.message)
    }
}

function formatAmount(ghs) {
    return String(Math.round(ghs * 100)).padStart(12, '0')
}

function generateTransactionId() {
    const t = String(Math.floor(Date.now() / 1000) % 1_000_000).padStart(6, '0')
    const r = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    return t + r
}

async function checkStatus(transactionId) {
    const res = await fetch(`${BASE}/v1.1/users/transactions/${transactionId}/status`, {
        method: 'GET',
        headers: {
            Authorization: authHeader(),
            'Merchant-Id': process.env.PAYSWITCH_MERCHANT_ID,
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(20_000),
        dispatcher,
    })
    const text = await res.text()
    console.log(`  HTTP ${res.status} →`, text.substring(0, 400))
    try { return JSON.parse(text) } catch { return null }
}

async function main() {
    reportConfig()
    await reportEgressIp()

    if (!authHeader() || !process.env.PAYSWITCH_MERCHANT_ID) {
        console.log('\nCredentials are incomplete — set PAYSWITCH_MERCHANT_ID, PAYSWITCH_API_USER and PAYSWITCH_API_KEY.')
        process.exit(1)
    }

    // Reachability + auth in one step: query a transaction id that cannot exist,
    // with each candidate key form. Anything other than 401/403 proves we reached
    // PaySwitch and it accepted the credentials.
    let reachable = false
    try {
        reachable = await probeAuth()
    } catch (err) {
        console.log('  FAILED:', err?.message, '| cause:', err?.cause?.code || err?.cause?.message)
    }

    if (!reachable) {
        if (proxyUrl) {
            console.log('\n  If this looks like a 407 or a cancelled request, the proxy credentials are')
            console.log('  rejected — rotate FIXIE_URL and re-whitelist its IP with PaySwitch.')
        }
        process.exit(1)
    }

    const chargeIdx = process.argv.indexOf('--charge')
    if (chargeIdx === -1) {
        console.log('\nDone. Re-run with:  --charge 233XXXXXXXXX MTN   to make one real GHS 0.10 debit')
        console.log('and capture the exact code/status values for approved, pending and declined.')
        return
    }

    const msisdn = process.argv[chargeIdx + 1]
    const network = process.argv[chargeIdx + 2] || 'MTN'
    const rSwitch = SWITCH_MAP[network]

    if (!msisdn || !/^\d{10,12}$/.test(msisdn) || !rSwitch) {
        console.log('\nUsage: --charge 233XXXXXXXXX [MTN|Telecel|AT]')
        process.exit(1)
    }

    const transactionId = generateTransactionId()
    const payload = {
        merchant_id: process.env.PAYSWITCH_MERCHANT_ID,
        transaction_id: transactionId,
        amount: formatAmount(0.1),
        processing_code: '000200',
        'r-switch': rSwitch,
        desc: 'ARHMS diagnostic',
        subscriber_number: msisdn,
    }

    console.log('\n' + sep)
    console.log(`Charging GHS 0.10 to ${msisdn} via ${rSwitch} (tx ${transactionId})`)
    console.log(sep)
    console.log('  request:', JSON.stringify({ ...payload, merchant_id: '<redacted>' }))

    const res = await fetch(`${BASE}/v1.1/transaction/process`, {
        method: 'POST',
        headers: {
            Authorization: authHeader(),
            'Merchant-Id': process.env.PAYSWITCH_MERCHANT_ID,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
        dispatcher,
    })
    const text = await res.text()
    console.log(`  initiate HTTP ${res.status} →`, text.substring(0, 600))
    console.log('\n  ^ RECORD THIS. If the prompt reached the handset, whatever code appears')
    console.log('    here is a PENDING code and belongs in PENDING_CODES.')

    console.log('\n' + sep)
    console.log('Polling status every 10s for 90s — approve, decline, and ignore the prompt')
    console.log('across separate runs to capture all three outcomes.')
    console.log(sep)
    for (let i = 1; i <= 9; i++) {
        await new Promise(r => setTimeout(r, 10_000))
        process.stdout.write(`  [${i * 10}s] `)
        await checkStatus(transactionId)
    }
}

main().catch(err => {
    console.error('\nDiagnostic crashed:', err)
    process.exit(1)
})
