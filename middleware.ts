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

    // ─── Sticky Shop Redirect (Ghosting Phase 1.5) ───
    // If user has visited a shop, auto-redirect/bounce them back if they try to go to root
    const shopVisitorCookie = request.cookies.get('shop_visitor')?.value
    const isExiting = request.nextUrl.searchParams.get('exit_shop') === 'true'

    // 1. Handle Exit: If user explicitly wants to leave shop mode
    if (isExiting) {
        const response = NextResponse.redirect(new URL('/', request.url))
        response.cookies.delete('shop_visitor')
        return addNoCacheHeaders(response)
    }

    // 2. Handle Bounce: If at root `/` and has cookie → Send back to shop
    if (pathname === '/' && shopVisitorCookie && !session) {
        // Only redirect if NOT logged in as admin/user (to avoid locking out owners)
        return NextResponse.redirect(new URL(`/shop/${shopVisitorCookie}`, request.url))
    }

    // Protected dashboard routes
    if (pathname.startsWith('/dashboard')) {
        if (!session) {
            return addNoCacheHeaders(NextResponse.redirect(new URL('/auth/login', request.url)))
        }
    }

    // Protected admin routes
    if (pathname.startsWith('/admin')) {
        if (!session) {
            return addNoCacheHeaders(NextResponse.redirect(new URL('/auth/login', request.url)))
        }

        try {
            // Add 8 second timeout to role check (increased for slow connections)
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
                return addNoCacheHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
            }
        } catch (error) {
            console.error('Middleware role check error:', error)
            // On error or timeout, redirect to dashboard (deny admin access)
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
    // Exclude static files to prevent unnecessary middleware execution
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)'
    ],
}
