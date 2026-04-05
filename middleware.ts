import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

// Helper to add cache-prevention headers
function addNoCacheHeaders(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
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


    let session = null

    try {
        // Add 10 second timeout to prevent hanging (increased for slow connections)
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Session timeout')), 10000)
        )

        const sessionPromise = supabase.auth.getSession()

        const { data } = await Promise.race([
            sessionPromise,
            timeout
        ]) as any

        session = data?.session || null
    } catch (error) {
        console.error('Middleware session error:', error)
        // On error or timeout, treat as no session
        session = null
    }

    // Protected dashboard routes
    if (pathname.startsWith('/dashboard')) {
        if (!session) {
            return addNoCacheHeaders(NextResponse.redirect(new URL('/auth/login', request.url)))
        }
    }

    // Protected admin routes (UI and API)
    const isAdminUI = pathname.startsWith('/admin')
    const isAdminAPI = pathname.startsWith('/api/admin')

    if (isAdminUI || isAdminAPI) {
        if (!session) {
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
                .eq('id', session.user.id)
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
                    console.warn(`[MiddlewareAudit] Sub-admin ${session.user.id} blocked from ${pathname}`)
                    
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
        if (session) {
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
