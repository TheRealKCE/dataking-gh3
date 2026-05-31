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
        // Extract name from Google OAuth metadata
        const meta = data.user.user_metadata ?? {}
        const rawName: string = meta.full_name ?? meta.name ?? ''
        const parts = rawName.trim().split(' ')
        const firstName = meta.given_name ?? parts[0] ?? ''
        const lastName  = meta.family_name ?? parts.slice(1).join(' ') ?? ''

        // Check if user already exists in public.users
        const { data: existingUser } = await adminClient
            .from('users')
            .select('id, phone_number, phone_verified, first_name, last_name')
            .eq('id', data.user.id)
            .single()

        console.log('[OAuthCallback] existing user:', JSON.stringify(existingUser))

        if (!existingUser) {
            // Brand new user — create their record with Google name
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
            // Update name from Google if not already set
            const needsNameUpdate = !existingUser.first_name || existingUser.first_name === ''
            if (needsNameUpdate && firstName) {
                await (adminClient.from('users') as any)
                    .update({ first_name: firstName, last_name: lastName })
                    .eq('id', data.user.id)
            }

            // Already verified — go straight to dashboard
            if (existingUser.phone_verified && existingUser.phone_number) {
                return NextResponse.redirect(new URL('/dashboard', origin))
            }
        }

        // All unverified Google users → verify-phone (enter phone + OTP)
        return NextResponse.redirect(new URL('/auth/verify-phone', origin))

    } catch (e) {
        console.error('[OAuthCallback] Error:', e)
        return NextResponse.redirect(new URL('/auth/verify-phone', origin))
    }
}
