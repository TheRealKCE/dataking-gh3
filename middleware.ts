import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req: request, res })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    const pathname = request.nextUrl.pathname

    // Protected dashboard routes
    if (pathname.startsWith('/dashboard')) {
        if (!session) {
            return NextResponse.redirect(new URL('/auth/login', request.url))
        }
    }

    // Protected admin routes
    if (pathname.startsWith('/admin')) {
        if (!session) {
            return NextResponse.redirect(new URL('/auth/login', request.url))
        }

        // Check if user is admin (full check in layout/components)
        const { data: user } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
    }

    // Redirect authenticated users away from auth pages
    if (pathname.startsWith('/auth')) {
        if (session) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return res
}

export const config = {
    matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/:path*'],
}
