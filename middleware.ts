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
        // Get session - if this hangs, the whole middleware hangs, but we add headers to response
        const { data } = await supabase.auth.getSession()
        session = data.session
    } catch {
        // On error, treat as no session
        session = null
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
            // Check if user is admin
            const { data: user } = await supabase
                .from('users')
                .select('role')
                .eq('id', session.user.id)
                .single()

            if (!user || user.role !== 'admin') {
                const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
                return addNoCacheHeaders(errorResponse)
            }
        } catch {
            // On error, deny access
            const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
            return addNoCacheHeaders(errorResponse)
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
    matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/:path*'],
}
