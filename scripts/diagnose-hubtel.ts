// @ts-nocheck
/**
 * Hubtel Connectivity Diagnostic
 * Run with: npx tsx scripts/diagnose-hubtel.ts
 *
 * Hubtel only accepts requests from IPs whitelisted in the Merchant Portal, so all
 * traffic goes through a static-IP proxy (FIXIE_URL). When payments fail with
 * "Could not reach the payment provider", the cause is almost always one of three
 * things, and undici's bare "fetch failed" tells you which one it is: none.
 *
 * This script separates them:
 *   1. proxy credentials rejected (407)  → rotate FIXIE_URL
 *   2. proxy unreachable                 → network/firewall or provider outage
 *   3. proxy fine, Hubtel says 403       → the proxy's IP is not whitelisted yet
 *
 * Prints no secrets — only credential lengths and status lines.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as net from 'net'
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
const proxyUrl = process.env.FIXIE_URL || process.env.QUOTAGUARDSTATIC_URL

/**
 * Prints this machine's public IP. On a fixed-IP host (a VPS, or a dev machine on a
 * static connection) you can whitelist this in Hubtel and skip the proxy entirely.
 * Not viable on Vercel, whose egress IPs rotate — that is what the proxy is for.
 */
async function reportEgressIp() {
    try {
        const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(10000) })
        const { ip } = await r.json()
        console.log(`\nThis machine's public egress IP: ${ip}`)
        console.log('Whitelisting that in Hubtel lets you run without a proxy from HERE only')
        console.log('(unset FIXIE_URL to go direct). Vercel needs the proxy — its IPs rotate.')
    } catch {
        console.log('\nCould not determine the public egress IP.')
    }
}

async function main() {
    console.log(sep)
    console.log('HUBTEL CONNECTIVITY DIAGNOSTIC')
    console.log(sep)

    // ── 1. Config presence ───────────────────────────────────────────────────
    const required = ['HUBTEL_CLIENT_ID', 'HUBTEL_CLIENT_SECRET', 'HUBTEL_COLLECTION_ACCOUNT_NUMBER']
    for (const key of required) {
        console.log(`${key.padEnd(34)}: ${process.env[key] ? 'set' : 'MISSING'}`)
    }
    console.log(`${'static proxy'.padEnd(34)}: ${proxyUrl ? 'set' : 'MISSING — Hubtel will 403'}`)

    if (!proxyUrl) {
        console.log('\nNo proxy configured. Set FIXIE_URL and whitelist its IP in Hubtel.')
        return
    }

    let u: URL
    try {
        u = new URL(proxyUrl)
    } catch {
        console.log('\nFIXIE_URL is not a valid URL. Expected: http://user:pass@host:port')
        return
    }

    const port = Number(u.port) || 80
    console.log(`${'proxy host'.padEnd(34)}: ${u.hostname}:${port}`)
    console.log(`${'proxy user'.padEnd(34)}: ${u.username || 'MISSING'}`)
    console.log(`${'proxy password length'.padEnd(34)}: ${u.password ? u.password.length : 0}`)

    // ── 2. Can we open a socket to the proxy at all? ──────────────────────────
    console.log(`\n${sep}\n1. TCP reachability`)
    const tcp = await new Promise<string>((resolve) => {
        const s = net.connect({ host: u.hostname, port })
        const t = setTimeout(() => { s.destroy(); resolve('TIMEOUT') }, 10000)
        s.on('connect', () => { clearTimeout(t); s.destroy(); resolve('OPEN') })
        s.on('error', (e: any) => { clearTimeout(t); resolve('ERROR ' + e.code) })
    })
    console.log(`   ${u.hostname}:${port} -> ${tcp}`)
    if (tcp !== 'OPEN') {
        console.log('   The proxy host is unreachable. Check the network or the provider status page.')
        return
    }

    // ── 3. Does the proxy accept our credentials? ─────────────────────────────
    console.log(`\n${sep}\n2. Proxy authentication (CONNECT)`)
    const creds = `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`
    const reply = await new Promise<string>((resolve) => {
        const s = net.connect({ host: u.hostname, port })
        const t = setTimeout(() => { s.destroy(); resolve('no reply within 15s') }, 15000)
        s.on('connect', () => s.write(
            'CONNECT rmp.hubtel.com:443 HTTP/1.1\r\n' +
            'Host: rmp.hubtel.com:443\r\n' +
            `Proxy-Authorization: Basic ${Buffer.from(creds).toString('base64')}\r\n\r\n`
        ))
        s.on('data', (d) => { clearTimeout(t); resolve(d.toString().split('\r\n')[0]); s.destroy() })
        s.on('error', (e: any) => { clearTimeout(t); resolve('ERROR ' + e.code) })
    })
    console.log(`   ${reply}`)

    if (reply.includes('407')) {
        console.log('\n   >> Credentials REJECTED. Payments cannot go out until this is fixed.')
        console.log('   >> Get a fresh URL from the proxy provider dashboard, update FIXIE_URL,')
        console.log('   >> then confirm its static IP is whitelisted in the Hubtel Merchant Portal.')
        return
    }
    if (!reply.includes('200')) {
        console.log('\n   >> Tunnel not established. See the status line above.')
        return
    }

    // ── 4. End to end, the way the app actually calls it ──────────────────────
    console.log(`\n${sep}\n3. Reaching Hubtel`)
    for (const [label, dispatcher] of [
        ['direct (expect 403 — IP not whitelisted)', new Agent()],
        ['via proxy (expect 200/401, NOT 403)', new ProxyAgent(proxyUrl)],
    ] as const) {
        try {
            const r = await fetch('https://rmp.hubtel.com/', {
                method: 'GET',
                signal: AbortSignal.timeout(15000),
                // @ts-ignore
                dispatcher,
            })
            console.log(`   ${String(label).padEnd(42)} -> HTTP ${r.status}`)
        } catch (e: any) {
            console.log(`   ${String(label).padEnd(42)} -> FAILED ${e.message} (${e.cause?.code || e.cause?.message || 'no cause'})`)
        }
    }

    console.log(`\n${sep}`)
    console.log('If the proxied call still returns 403, the proxy works but its IP is not')
    console.log('whitelisted in Hubtel. Add it in the Merchant Portal.')
    console.log(sep)
}

// Runs after every exit path — main() returns early on each distinct failure, and
// the egress IP is most useful precisely when something failed.
main()
    .catch((e) => { console.error('Diagnostic crashed:', e) })
    .finally(reportEgressIp)
