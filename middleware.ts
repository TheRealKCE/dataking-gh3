import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Helper to add cache-prevention headers
function addNoCacheHeaders(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
}

export async function middleware(request: NextRequest) {
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req: request, res })

    const pathname = request.nextUrl.pathname

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

    return addNoCacheHeaders(res)
}

export const config = {
    // Exclude static files but INCLUDE api/admin for protection
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)'
    ],
}
