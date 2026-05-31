import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

    if (!code) {
        return NextResponse.redirect(new URL('/auth/login', origin))
    }

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore
    })

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user) {
        console.error('[OAuthCallback] Code exchange failed:', error)
        return NextResponse.redirect(new URL('/auth/login?error=oauth_failed', origin))
    }

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
        const { data: dbUser, error: dbError } = await adminClient
            .from('users')
            .select('phone_number, phone_verified')
            .eq('id', data.user.id)
            .single()

        console.log('[OAuthCallback] user id:', data.user.id)
        console.log('[OAuthCallback] dbUser:', JSON.stringify(dbUser))
        console.log('[OAuthCallback] dbError:', JSON.stringify(dbError))

        // If DB query fails (e.g. phone_verified column missing) or user not in public.users
        if (dbError || !dbUser) {
            console.warn('[OAuthCallback] Could not load user from public.users — sending to complete-profile')
            return NextResponse.redirect(new URL('/auth/complete-profile', origin))
        }

        if (!dbUser.phone_number || dbUser.phone_number === '') {
            return NextResponse.redirect(new URL('/auth/complete-profile', origin))
        }

        if (!dbUser.phone_verified) {
            return NextResponse.redirect(new URL('/auth/verify-phone', origin))
        }

        return NextResponse.redirect(new URL('/dashboard', origin))
    } catch (e) {
        console.error('[OAuthCallback] Unexpected error:', e)
        return NextResponse.redirect(new URL('/auth/complete-profile', origin))
    }
}
