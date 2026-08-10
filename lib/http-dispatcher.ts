/**
 * Shared outbound HTTP dispatcher for payment gateways that require IP whitelisting.
 *
 * Vercel runs on dynamic/rotating IPs, so any gateway that whitelists us by IP
 * (Hubtel today, potentially PaySwitch) has to be reached through a static proxy.
 * This lives outside any one gateway's service file so every caller shares a
 * single connection pool — see the comment in getDispatcher().
 */
import { ProxyAgent, Agent } from 'undici'

let cachedDispatcher: ProxyAgent | Agent | null = null

/**
 * Returns an undici dispatcher that routes API traffic through a static proxy IP.
 *
 * Priority: FIXIE_URL → QUOTAGUARDSTATIC_URL → no proxy (will fail on Vercel)
 */
export function getDispatcher(): ProxyAgent | Agent {
    // Built once per process, not once per request. Every ProxyAgent owns a
    // connection pool; constructing one per call meant no keep-alive reuse and a
    // steady leak of sockets that were never destroyed — each payment paid for a
    // fresh TCP + TLS handshake through the proxy, and a busy instance eventually
    // ran out of descriptors. Env is fixed for the life of the process, so a
    // single instance is safe to share.
    if (cachedDispatcher) return cachedDispatcher

    const proxyUrl = process.env.FIXIE_URL || process.env.QUOTAGUARDSTATIC_URL
    if (proxyUrl) {
        console.log('[HttpDispatcher] Routing through static proxy:', proxyUrl.split('@')[1] ?? 'proxy')
        cachedDispatcher = new ProxyAgent(proxyUrl)
    } else {
        console.warn('[HttpDispatcher] No static proxy configured (FIXIE_URL). IP-whitelisted gateways will likely return 403 on Vercel.')
        cachedDispatcher = new Agent()
    }
    return cachedDispatcher
}

/** True when a static proxy is configured — used by error diagnostics. */
export function isUsingStaticProxy(): boolean {
    return !!(process.env.FIXIE_URL || process.env.QUOTAGUARDSTATIC_URL)
}
