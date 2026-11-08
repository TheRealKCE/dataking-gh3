import crypto from 'crypto'

// Kuntanii webhook signature (X-Kuntanii-Signature). See app/api/webhooks/kuntanii.

function safeEqual(a: string, b: string): boolean {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export function verifyKuntaniiSignature(rawBody: string, header: string | null, secret: string): boolean {
    if (!header) return false
    const h = header.trim()

    // Stripe-style: t=<unix>,v1=<hex>
    if (/(^|,)\s*v1=/.test(h)) {
        const parts = Object.fromEntries(h.split(',').map(p => p.trim().split('=') as [string, string]))
        if (!parts.t || !parts.v1) return false
        const mac = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex')
        return safeEqual(mac, parts.v1.toLowerCase())
    }

    const sig = h.replace(/^sha256=/i, '')
    const mac = crypto.createHmac('sha256', secret).update(rawBody)
    const digest = mac.digest()
    return safeEqual(digest.toString('hex'), sig.toLowerCase()) || safeEqual(digest.toString('base64'), sig)
}

export function describeHeader(h: string | null): string {
    if (!h) return 'missing'
    const t = h.trim()
    if (/v1=/.test(t)) return 'stripe-style t=,v1='
    if (/^sha256=/i.test(t)) return `sha256= prefix, ${t.length - 7} chars`
    if (/^[0-9a-f]+$/i.test(t)) return `bare hex, ${t.length} chars`
    return `other, ${t.length} chars`
}

