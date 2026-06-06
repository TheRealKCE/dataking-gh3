import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

    if (!code) {
        // Implicit flow — fragment-based token, client-side Supabase will pick it up
        return NextResponse.redirect(new URL('/auth/verify-phone', origin))
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
        // Extract name from Google OAuth metadata
        const meta = data.user.user_metadata ?? {}
        const rawName: string = meta.full_name ?? meta.name ?? ''
        const parts = rawName.trim().split(' ')
        const firstName = meta.given_name ?? parts[0] ?? ''
        const lastName  = meta.family_name ?? parts.slice(1).join(' ') ?? ''

        // Check if user already exists in public.users
        const { data: existingUser } = await adminClient
            .from('users')
            .select('id, phone_number, first_name, last_name')
            .eq('id', data.user.id)
            .single()

        console.log('[OAuthCallback] existing user:', JSON.stringify(existingUser))

        let targetPath = '/auth/verify-phone' // default: new users must enter phone

        if (!existingUser) {
            // Brand new user — create their record with Google name, no phone yet
            await (adminClient.from('users') as any).insert({
                id: data.user.id,
                email: data.user.email,
                first_name: firstName,
                last_name: lastName,
                phone_number: '',
                phone_verified: false,
                role: 'customer',
                status: 'active',
            })
        } else {
            // Update name if missing
            const needsNameUpdate = !existingUser.first_name || existingUser.first_name === ''
            if (needsNameUpdate && firstName) {
                await (adminClient.from('users') as any)
                    .update({ first_name: firstName, last_name: lastName })
                    .eq('id', data.user.id)
            }

            // Returning user who already has a phone number → go straight to dashboard
            if (existingUser.phone_number && existingUser.phone_number !== '') {
                targetPath = '/dashboard'
            }
        }

        // Next.js 15 handles cookies perfectly with 302 redirects, no need for the HTML workaround
        const response = NextResponse.redirect(new URL(targetPath, requestUrl.origin))
        
        // IMPORTANT FIX: In Next.js 15, mutating the cookie store inside a route handler 
        // using older Supabase packages does not always automatically attach the Set-Cookie headers 
        // to a newly instantiated NextResponse. We must explicitly copy them over.
        cookieStore.getAll().forEach(cookie => {
            if (cookie.name.startsWith('sb-') || cookie.name.startsWith('supabase-')) {
                response.cookies.set(cookie.name, cookie.value, {
                    path: '/',
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 60 * 60 * 24 * 365,
                })
            }
        })

        return response

    } catch (e) {
        console.error('[OAuthCallback] Error:', e)
        return NextResponse.redirect(new URL('/auth/verify-phone', requestUrl.origin))
    }
}
