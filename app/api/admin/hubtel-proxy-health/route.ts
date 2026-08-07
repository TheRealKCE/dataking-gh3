import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { ProxyAgent, Agent } from 'undici'

/**
 * Reports whether Hubtel is reachable FROM VERCEL through the static proxy.
 *
 * scripts/diagnose-hubtel.ts answers the same question from a developer laptop,
 * which turns out not to be the question that matters: the laptop has its own
 * .env.local and its own egress IP, so it can pass while production fails. That
 * gap cost real time during an outage where every payment 407'd in production
 * while the identical check ran clean locally. This route closes it by running
 * inside the deployment, against the deployment's own environment.
 *
 * Protected with CRON_SECRET — the same shared secret the cron routes use, so it
 * needs no new configuration.
 *
 * Costs ONE metered proxy request per call (see lib/hubtel-status-throttle.ts for
 * why that matters). Do not put this on a schedule.
 */

// Must not be prerendered or cached — it reports live state.
export const dynamic = 'force-dynamic'
// undici's ProxyAgent needs the Node runtime; the edge runtime cannot dial a proxy.
export const runtime = 'nodejs'

/**
 * A comparable fingerprint of a secret, leaking none of it.
 *
 * The point is to answer "does production hold the same FIXIE_URL as my laptop?"
 * Printing the value — even partially masked — would publish a live credential to
 * whoever reads the response or the logs. A truncated hash compares exactly and
 * reveals nothing, and 12 hex chars is far beyond what is needed to tell two
 * candidate strings apart.
 */
function fingerprint(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const proxyUrl = process.env.FIXIE_URL || process.env.QUOTAGUARDSTATIC_URL || ''

    const report: Record<string, any> = {
        checkedAt: new Date().toISOString(),
        vercelEnv: process.env.VERCEL_ENV ?? null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        proxy: {
            source: process.env.FIXIE_URL ? 'FIXIE_URL' : process.env.QUOTAGUARDSTATIC_URL ? 'QUOTAGUARDSTATIC_URL' : null,
            configured: !!proxyUrl,
        },
    }

    if (!proxyUrl) {
        // Not a degraded state — on Vercel it means every Hubtel call is going out
        // from a rotating IP that Hubtel will reject outright.
        report.verdict = 'NO_PROXY_CONFIGURED — Hubtel will 403 every payment from Vercel'
        return NextResponse.json(report, { status: 200 })
    }

    try {
        const u = new URL(proxyUrl)
        report.proxy.host = `${u.hostname}:${u.port || 80}`
        report.proxy.user = u.username || null
        report.proxy.passwordLength = u.password ? u.password.length : 0
        // Compare these against the local values to tell whether production and the
        // laptop are even using the same credential.
        report.proxy.urlFingerprint = fingerprint(proxyUrl)
        report.proxy.passwordFingerprint = u.password ? fingerprint(u.password) : null
    } catch {
        report.verdict = 'PROXY_URL_MALFORMED — expected http://user:pass@host:port'
        return NextResponse.json(report, { status: 200 })
    }

    // The same call the payment service makes, minus the payment. 401 is the healthy
    // answer: we reached Hubtel and it declined an unauthenticated GET. 403 means we
    // reached it from an IP it does not recognise — the proxy works but is not
    // whitelisted. A thrown error means we never got there at all.
    async function probe(label: string, dispatcher: ProxyAgent | Agent) {
        const started = Date.now()
        try {
            const r = await fetch('https://rmp.hubtel.com/', {
                method: 'GET',
                signal: AbortSignal.timeout(15000),
                // @ts-ignore — undici's dispatcher is not in the DOM fetch types
                dispatcher,
            })
            return { label, httpStatus: r.status, ms: Date.now() - started }
        } catch (err: any) {
            return {
                label,
                error: err?.message ?? String(err),
                cause: err?.cause?.message ?? err?.cause?.code ?? null,
                ms: Date.now() - started,
            }
        }
    }

    report.viaProxy = await probe('via proxy', new ProxyAgent(proxyUrl))

    const status = report.viaProxy.httpStatus
    if (status === 401 || status === 200) {
        report.verdict = 'HEALTHY — reached Hubtel through the proxy from a whitelisted IP'
    } else if (status === 403) {
        report.verdict = 'IP_NOT_WHITELISTED — proxy works, but Hubtel does not recognise its IP. Add it in the Merchant Portal.'
    } else if (status) {
        report.verdict = `UNEXPECTED_STATUS ${status} — reached Hubtel but not with an answer we know how to read`
    } else {
        // This is the shape the 20:53 outage took: no HTTP status at all, because the
        // proxy refused the tunnel before Hubtel was ever contacted.
        report.verdict = 'PROXY_UNREACHABLE_OR_REJECTED — check credentials, quota, and the provider status page'
    }

    return NextResponse.json(report, { status: 200 })
}
