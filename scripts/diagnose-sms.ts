/**
 * SMS Diagnostic Script
 * Run with: npx tsx scripts/diagnose-sms.ts
 *
 * This will show you EXACTLY what Moolre returns so we can fix it.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const MOOLRE_API_KEY = process.env.MOOLRE_API_KEY
const MOOLRE_API_URL = process.env.MOOLRE_API_URL?.replace('/open/sms/send', '') || 'https://api.moolre.com'
const MOOLRE_SENDER_ID = process.env.MOOLRE_SENDER_ID || 'ARHMS'
const MNOTIFY_API_KEY = process.env.MNOTIFY_API_KEY
const MNOTIFY_SENDER_ID = process.env.MNOTIFY_SENDER_ID || 'ARHMSGh'

// ─── Change this to a real Ghana number for testing ───────────────────────────
const TEST_PHONE = '0551617309'
// ─────────────────────────────────────────────────────────────────────────────

const sep = '─'.repeat(60)

async function diagnose() {
    console.log(sep)
    console.log('SMS DIAGNOSTIC REPORT')
    console.log(sep)

    // ── 1. Env Var Check ──────────────────────────────────────────────────────
    console.log('\n[1] ENVIRONMENT VARIABLES')
    console.log('MOOLRE_API_KEY   :', MOOLRE_API_KEY ? `${MOOLRE_API_KEY.slice(0, 6)}...${MOOLRE_API_KEY.slice(-4)} (length: ${MOOLRE_API_KEY.length})` : 'NOT SET ❌')
    console.log('MOOLRE_API_URL   :', MOOLRE_API_URL)
    console.log('MOOLRE_SENDER_ID :', MOOLRE_SENDER_ID)
    console.log('MNOTIFY_API_KEY  :', MNOTIFY_API_KEY ? `${MNOTIFY_API_KEY.slice(0, 10)}... (length: ${MNOTIFY_API_KEY.length})` : 'NOT SET ❌')
    console.log('MNOTIFY_SENDER_ID:', MNOTIFY_SENDER_ID)
    console.log('SMS_ENABLED      :', process.env.SMS_ENABLED || 'NOT SET (defaults to enabled)')

    const isPlaceholder = !MOOLRE_API_KEY || ['placeholder', 'your_', '_here'].some(p => MOOLRE_API_KEY.toLowerCase().includes(p))
    if (isPlaceholder) {
        console.log('\n❌ MOOLRE_API_KEY is still a placeholder. Update .env.local with your real key.')
        console.log('   Skipping Moolre API test.')
    }

    // ── 2. Moolre API Test ────────────────────────────────────────────────────
    if (!isPlaceholder && MOOLRE_API_KEY) {
        console.log('\n' + sep)
        console.log('[2] MOOLRE API TEST')
        console.log(sep)

        const phone = TEST_PHONE.startsWith('0') && TEST_PHONE.length === 10
            ? '233' + TEST_PHONE.slice(1)
            : TEST_PHONE.replace(/^\+/, '')

        const endpoints = [
            '/open/sms/send',
            '/sms/send',
            '/sms/quick',
            '/messages',
            '/sms',
        ]

        const targetUrl = `${MOOLRE_API_URL}/open/sms/send`
        const payload = {
            recipient: phone,
            message: '[ARHMS Diagnostic Test] SMS is working.',
            sender_id: MOOLRE_SENDER_ID,
        }

        const authMethods = [
            { label: 'Bearer token',      headers: { 'Authorization': `Bearer ${MOOLRE_API_KEY}` } },
            { label: 'X-API with ArhmsTech',  headers: { 'X-API-Key': MOOLRE_API_KEY, 'X-API-USER': 'ArhmsTech' } },
            { label: 'X-API with ARHMS',  headers: { 'X-API-Key': MOOLRE_API_KEY, 'X-API-USER': 'ARHMS' } },
            { label: 'X-API with elitedatahub3',  headers: { 'X-API-Key': MOOLRE_API_KEY, 'X-API-USER': 'elitedatahub3' } },
            { label: 'api_key query param', url: `${targetUrl}?api_key=${MOOLRE_API_KEY}`, headers: {} },
        ]

        for (const method of authMethods) {
            const url = (method as any).url || targetUrl
            const body = { ...payload, ...(method.extraBody || {}) }
            console.log(`\nTrying auth: ${method.label}`)

            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...method.headers } as any,
                    body: JSON.stringify(body),
                })
                const text = await res.text()
                let json: any = null
                try { json = JSON.parse(text) } catch { }

                const response = json ? JSON.stringify(json) : text.slice(0, 200)
                console.log(`  HTTP ${res.status} → ${response}`)

                // Success: status 1 or "success" or no auth error code
                if (json && (json.status === 1 || json.code === 'success' || json.message?.toLowerCase().includes('success'))) {
                    console.log(`  ✅ THIS AUTH METHOD WORKS: ${method.label}`)
                    break
                }
                if (json && json.code !== 'AIN01' && res.status === 200) {
                    console.log(`  ⚠️  Different response — might be progress`)
                }
            } catch (err: any) {
                console.log(`  Network error: ${err.message}`)
            }
        }
    }

    // ── 3. mNotify Fallback Test ──────────────────────────────────────────────
    console.log('\n' + sep)
    console.log('[3] MNOTIFY FALLBACK TEST')
    console.log(sep)

    if (!MNOTIFY_API_KEY) {
        console.log('❌ MNOTIFY_API_KEY not set.')
    } else {
        const phone = TEST_PHONE.startsWith('233') ? '0' + TEST_PHONE.slice(3) : TEST_PHONE
        const url = `https://api.mnotify.com/api/sms/quick?key=${MNOTIFY_API_KEY}`
        const payload = {
            recipient: [phone],
            sender: MNOTIFY_SENDER_ID,
            message: '[ARHMS Diagnostic Test] mNotify SMS is working.',
            is_schedule: false,
            schedule_date: '',
        }
        console.log(`POST ${url.replace(MNOTIFY_API_KEY, '***')}`)
        console.log('Payload:', JSON.stringify({ ...payload, message: '[ARHMS Test]' }))

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const text = await res.text()
            console.log(`HTTP Status: ${res.status} ${res.statusText}`)
            try {
                const json = JSON.parse(text)
                console.log('Response JSON:', JSON.stringify(json, null, 2))
                if (json.status === 'success' || json.code === '2000') {
                    console.log('✅ mNotify is working!')
                } else {
                    console.log('❌ mNotify returned error. Check sender ID is registered.')
                }
            } catch {
                console.log('Response (raw):', text.slice(0, 300))
            }
        } catch (err: any) {
            console.log('Network error:', err.message)
        }
    }

    console.log('\n' + sep)
    console.log('DIAGNOSTIC COMPLETE')
    console.log(sep)
}

diagnose().catch(console.error)
