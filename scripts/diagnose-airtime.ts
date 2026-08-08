// @ts-nocheck
/**
 * Airtime auto-fulfilment diagnostic.
 * Run with: npx tsx scripts/diagnose-airtime.ts [REFERENCE_CODE]
 *
 * An airtime order that stays 'pending' has exactly one of a few causes, and the
 * order row alone does not tell you which. This separates them:
 *
 *   1. migration not applied   -> airtime_fulfillment_legs does not exist
 *   2. toggles off / missing   -> dispatcher declines before calling Hubtel
 *   3. env not configured      -> dispatcher throws, order left pending
 *   4. Hubtel rejected a leg   -> fulfillment_note says so, leg row is 'failed'
 *
 * Read-only. Prints no secrets.
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

for (const file of ['.env.local', '.env']) {
    const p = path.join(__dirname, '..', file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
    }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}
const db = createClient(url, key)

async function main() {
    console.log('=== 1. Migration applied? ===')
    const { error: legsErr } = await db.from('airtime_fulfillment_legs').select('id').limit(1)
    if (legsErr) {
        console.log(`  airtime_fulfillment_legs: NOT REACHABLE -> ${legsErr.code || ''} ${legsErr.message}`)
    } else {
        console.log('  airtime_fulfillment_legs: exists')
    }

    const { data: cols } = await db.from('airtime_orders')
        .select('provider, provider_reference, auto_fulfillment_attempted_at').limit(1)
    console.log(`  airtime_orders provider columns: ${cols ? 'exist' : 'MISSING'}`)

    console.log('\n=== 2. Toggles ===')
    const { data: settings } = await db.from('admin_settings').select('key, value')
        .in('key', ['airtime_auto_fulfillment_enabled', 'airtime_auto_mtn', 'airtime_auto_telecel', 'airtime_auto_at'])
    const found = new Set((settings || []).map((s: any) => s.key))
    for (const k of ['airtime_auto_fulfillment_enabled', 'airtime_auto_mtn', 'airtime_auto_telecel', 'airtime_auto_at']) {
        const row = (settings || []).find((s: any) => s.key === k)
        console.log(`  ${k.padEnd(34)} ${found.has(k) ? row.value : 'ROW MISSING'}`)
    }

    console.log('\n=== 3. Env (names only) ===')
    for (const k of ['HUBTEL_PREPAID_ACCOUNT_NUMBER', 'HUBTEL_AIRTIME_CLIENT_ID', 'HUBTEL_CLIENT_ID', 'CRON_SECRET', 'FIXIE_URL']) {
        console.log(`  ${k.padEnd(32)} ${process.env[k] ? 'set' : 'NOT SET'}`)
    }
    console.log(`  NEXT_PUBLIC_APP_URL              ${process.env.NEXT_PUBLIC_APP_URL || 'NOT SET'}`)

    console.log('\n=== 4. Recent airtime orders ===')
    const ref = process.argv[2]
    let q = db.from('airtime_orders')
        .select('reference_code, network, airtime_amount, beneficiary_phone, status, type, provider, auto_fulfillment_attempted_at, fulfillment_note, created_at')
        .order('created_at', { ascending: false }).limit(ref ? 1 : 8)
    if (ref) q = q.eq('reference_code', ref)
    const { data: orders, error: oErr } = await q
    if (oErr) { console.log(`  error: ${oErr.message}`); return }

    for (const o of (orders || [])) {
        console.log(`\n  ${o.reference_code}  ${o.network} GHS ${o.airtime_amount}  -> ${o.beneficiary_phone}`)
        console.log(`    status=${o.status} type=${o.type} provider=${o.provider || 'none'}`)
        console.log(`    attempted_at=${o.auto_fulfillment_attempted_at || 'NEVER'}`)
        console.log(`    note=${o.fulfillment_note || '(none)'}`)
        console.log(`    created=${o.created_at}`)
    }
}

main().catch((e) => { console.error(e); process.exit(1) })
