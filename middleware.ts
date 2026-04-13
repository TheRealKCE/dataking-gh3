import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ============================================================
// STRICT CORS ALLOWLIST - Only these origins are trusted.
// NEVER add a wildcard (*) here. Never reflect the raw Origin.
// ============================================================
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
    'https://kingflexygh.com',
    'https://www.kingflexygh.com',
    // Remove this line in production once testing is done:
    'http://localhost:3000',
])

// ============================================================
// UPSTASH REDIS CLIENT & RATE LIMITERS
// Initialized once at module level — reused across all requests.
// Redis.fromEnv() reads UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN from environment variables.
// ============================================================
const redis = Redis.fromEnv()

const rateLimiters = {
    // ── Auth routes ────────────────────────────────────────────
    login: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m') }),
    signup: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h') }),
    forgotPassword: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h') }),
    // ── Admin routes (broad) ───────────────────────────────────
    adminProcessWithdrawal: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m') }),
    admin: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m') }),
    adminSettings: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }),
    supplierBalance: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }),
    // ── Orders & Purchases ─────────────────────────────────────
    airtimeCreate: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m') }),
    ordersPurchase: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m') }),
    ordersBulk: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 m') }),
    // ── Payments ──────────────────────────────────────────────
    paymentsInitialize: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }),
    paymentsVerify: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m') }),
    // ── Shop ──────────────────────────────────────────────────
    shopValidateAccount: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m') }),
    shopInitialize: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }),
    shopVerifyOrder: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m') }),
    shopPricing: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m') }),
    shopWithdraw: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h') }),
    shopAnnouncements: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m') }),
    shopAlerts: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m') }),
    shopLookupOrders: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m') }),
    shopMyOrders: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m') }),
    // ── Webhooks ──────────────────────────────────────────────
    webhook: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m') }),
    // ── User actions ──────────────────────────────────────────
    user: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m') }),
    userUpgrade: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h') }),
    afaRegistration: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, '1 h') }),
    agentDowngrade: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, '1 h') }),
    updateProfile: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m') }),
    deleteAccount: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, '24 h') }),
    airtimeHistory: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m') }),
    // ── Support & Cron ────────────────────────────────────────
    supportChat: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }),
    cron: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }),
    // ── General catch-all ─────────────────────────────────────
    general: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m') }),
}

// Helper to add cache-prevention headers
function addNoCacheHeaders(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
}

// Returns a consistent 429 response with Retry-After and no-cache headers.
function rateLimitExceeded(retryAfter: number): NextResponse {
    const response = NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
    )
    response.headers.set('Retry-After', retryAfter.toString())
    return addNoCacheHeaders(response)
}

// Extracts the real client IP from Vercel/proxy headers.
// x-forwarded-for is the most reliable source on Vercel.
function getIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
        ?? (request as any).ip
        ?? '127.0.0.1'
}

// Sets CORS headers ONLY for explicitly allowlisted origins.
// Never reflects the raw origin. Never uses wildcard with credentials.
function setCORSHeaders(response: NextResponse, origin: string | null): NextResponse {
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        response.headers.set('Vary', 'Origin')
    }
    // For untrusted/missing origins: emit NO Access-Control-* headers at all.
    return response
}

export async function middleware(request: NextRequest) {
    const origin = request.headers.get('origin')
    const pathname = request.nextUrl.pathname

    // === CORS PREFLIGHT HANDLER ===
    // Handle OPTIONS preflight FIRST, before any Supabase logic.
    if (request.method === 'OPTIONS') {
        if (origin && ALLOWED_ORIGINS.has(origin)) {
            // Trusted origin: approve the preflight
            const preflightResponse = new NextResponse(null, { status: 204 })
            return addNoCacheHeaders(setCORSHeaders(preflightResponse, origin))
        } else {
            // Untrusted origin: reject the preflight entirely
            return new NextResponse(null, { status: 403 })
        }
    }

    // === ORIGIN ENFORCEMENT FOR API ROUTES ===
    // For cross-origin requests (Origin header present) to API routes,
    // block the request if origin is not in the allowlist.
    if (origin && pathname.startsWith('/api') && !ALLOWED_ORIGINS.has(origin)) {
        console.warn(`[CORS] Blocked request from untrusted origin: ${origin} → ${pathname}`)
        return new NextResponse(
            JSON.stringify({ error: 'CORS: Origin not allowed' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
    }

    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req: request, res })


    let authUser = null

    try {
        // Add 10 second timeout to prevent hanging (increased for slow connections)
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Session timeout')), 10000)
        )

        const userPromise = supabase.auth.getUser()

        const { data } = await Promise.race([
            userPromise,
            timeout
        ]) as any

        authUser = data?.user || null
    } catch (error) {
        console.error('Middleware session error:', error)
        // On error or timeout, treat as no session
        authUser = null
    }

    // === RATE LIMITING ===
    // Runs AFTER supabase.auth.getUser() so authUser.id is available for
    // user/admin-keyed limits. Runs BEFORE role checks to guard the
    // expensive database query.
    // OPTIONS preflights are already short-circuited above — safe.
    try {
        const ip = getIP(request)
        let limiter: Ratelimit | null = null
        let identifier: string = ip

        if (pathname === '/api/cron/sync-moolre-withdrawals') {
            limiter = null // Excluded entirely; protected by CRON_SECRET only
        } else if (pathname === '/api/shop/validate-account') {
            limiter = rateLimiters.shopValidateAccount
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/admin/process-withdrawal') {
            limiter = rateLimiters.adminProcessWithdrawal
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/auth/login') {
            limiter = rateLimiters.login
            identifier = ip
        } else if (pathname === '/api/auth/signup') {
            limiter = rateLimiters.signup
            identifier = ip
        } else if (pathname === '/api/auth/forgot-password') {
            limiter = rateLimiters.forgotPassword
            identifier = ip
        } else if (pathname === '/api/admin/get-prices') {
            limiter = rateLimiters.general
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname.startsWith('/api/admin')) {
            limiter = rateLimiters.admin
            identifier = authUser?.id ?? ip
        } else if (pathname === '/api/shop/initialize') {
            limiter = rateLimiters.shopInitialize
            identifier = ip
        } else if (pathname === '/api/webhooks/paystack') {
            limiter = rateLimiters.webhook
            identifier = ip
        } else if (pathname === '/api/airtime/create') {
            limiter = rateLimiters.airtimeCreate
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/orders/purchase') {
            limiter = rateLimiters.ordersPurchase
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/orders/bulk-purchase') {
            limiter = rateLimiters.ordersBulk
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/payments/initialize') {
            limiter = rateLimiters.paymentsInitialize
            identifier = ip
        } else if (pathname === '/api/payments/verify') {
            limiter = rateLimiters.paymentsVerify
            identifier = ip
        } else if (pathname === '/api/shop/verify') {
            limiter = rateLimiters.shopVerifyOrder
            identifier = ip
        } else if (pathname === '/api/user/upgrade/initialize') {
            limiter = rateLimiters.userUpgrade
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/shop/pricing') {
            limiter = rateLimiters.shopPricing
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/shop/withdraw') {
            limiter = rateLimiters.shopWithdraw
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/shop/announcements') {
            limiter = rateLimiters.shopAnnouncements
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/shop/alerts') {
            limiter = rateLimiters.shopAlerts
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/users/update-profile') {
            limiter = rateLimiters.updateProfile
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/users/delete-account') {
            limiter = rateLimiters.deleteAccount
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/user/afa-registration') {
            limiter = rateLimiters.afaRegistration
            identifier = ip
        } else if (pathname === '/api/agent/downgrade') {
            limiter = rateLimiters.agentDowngrade
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/admin-settings') {
            limiter = rateLimiters.adminSettings
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/shop/lookup-orders') {
            limiter = rateLimiters.shopLookupOrders
            identifier = ip
        } else if (pathname === '/api/shop/my-orders') {
            limiter = rateLimiters.shopMyOrders
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/airtime/history') {
            limiter = rateLimiters.airtimeHistory
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname.startsWith('/api/admin/supplier-balance')) {
            limiter = rateLimiters.supplierBalance
            identifier = authUser?.id ? `${authUser.id}-${ip}` : ip
        } else if (pathname === '/api/support-chat') {
            limiter = rateLimiters.supportChat
            identifier = ip
        } else if (pathname.startsWith('/api/cron')) {
            limiter = rateLimiters.cron
            identifier = ip
        } else if (pathname.startsWith('/api/user')) {
            limiter = rateLimiters.user
            identifier = authUser?.id ?? ip
        } else if (pathname.startsWith('/api')) {
            limiter = rateLimiters.general
            identifier = ip
        }

        if (limiter) {
            const { success, reset } = await limiter.limit(identifier)
            if (!success) {
                const retryAfter = Math.ceil((reset - Date.now()) / 1000)
                return rateLimitExceeded(Math.max(1, retryAfter))
            }
        }
    } catch (error) {
        // Fail open — never block legitimate users due to Redis downtime.
        console.error('[RateLimiter] Redis error, failing open:', error)
    }

    // Protected dashboard routes
    if (pathname.startsWith('/dashboard')) {
        if (!authUser) {
            return addNoCacheHeaders(NextResponse.redirect(new URL('/auth/login', request.url)))
        }
    }

    // Protected admin routes (UI and API)
    const isAdminUI = pathname.startsWith('/admin')
    const isAdminAPI = pathname.startsWith('/api/admin')

    // Whitelisted admin endpoints accessible to all authenticated users
    const adminPublicEndpoints = ['/api/admin/get-prices']
    const isAdminPublicEndpoint = adminPublicEndpoints.some(ep => pathname === ep)

    if ((isAdminUI || isAdminAPI) && !isAdminPublicEndpoint) {
        if (!authUser) {
            if (isAdminAPI) return addNoCacheHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
            return addNoCacheHeaders(NextResponse.redirect(new URL('/auth/login', request.url)))
        }

        try {
            // Add 8 second timeout to role check
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Role check timeout')), 8000)
            )

            const roleQuery = supabase
                .from('users')
                .select('role')
                .eq('id', authUser.id)
                .single()

            const { data: user } = await Promise.race([
                roleQuery,
                timeout
            ]) as any

            if (!user || (user.role !== 'admin' && user.role !== 'sub-admin')) {
                if (isAdminAPI) return addNoCacheHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
                return addNoCacheHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
            }

            // Strict Sub-Admin Lockdown
            if (user.role === 'sub-admin') {
                const isOrderPath = pathname.includes('/admin/orders')

                if (!isOrderPath) {
                    console.warn(`[MiddlewareAudit] Sub-admin ${authUser.id} blocked from ${pathname}`)

                    if (isAdminAPI) {
                        return addNoCacheHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
                    }

                    return addNoCacheHeaders(NextResponse.redirect(new URL('/admin/orders', request.url)))
                }
            }
        } catch (error) {
            console.error('Middleware role check error:', error)
            if (isAdminAPI) return addNoCacheHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
            return addNoCacheHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
        }
    }

    // Redirect authenticated users away from auth pages
    if (pathname.startsWith('/auth')) {
        if (authUser) {
            return addNoCacheHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
        }
    }

    return addNoCacheHeaders(setCORSHeaders(res, origin))
}

export const config = {
    // Exclude static files but INCLUDE api/admin for protection
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)'
    ],
}
