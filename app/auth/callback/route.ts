import { createServerClient } from '@supabase/ssr'
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
    // Create a dummy response to hold the cookies during initialization
    let sessionResponse = new NextResponse()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options)
                        sessionResponse.cookies.set({ name, value, ...options })
                    })
                },
            },
        }
    )

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
        const lastName = meta.family_name ?? parts.slice(1).join(' ') ?? ''

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

        // Use a 200 HTML meta-refresh instead of 302 redirect.
        // Vercel's edge network can strip Set-Cookie headers from 302 responses,
        // causing the session cookie to be lost. A 200 with meta-refresh ensures
        // the browser stores the cookies BEFORE navigating to the next page.
        const htmlResponse = new NextResponse(
            `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${targetPath}"><script>window.location.href = '${targetPath}';</script></head><body>Redirecting...</body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html' } }
        )

        // Explicitly copy the generated session cookies to the final response
        sessionResponse.cookies.getAll().forEach(cookie => {
            htmlResponse.cookies.set(cookie)
        })

        return htmlResponse
        11:06: 42.960 Running build in Washington, D.C., USA(East) – iad1
        11:06: 42.960 Build machine configuration: 4 cores, 8 GB
        11:06: 43.070 Cloning github.com / elitedatahub3 / arhms - data - ltd(Branch: main, Commit: beaf8a2)
        11:06: 43.754 Cloning completed: 684.000ms
        11:06: 45.019 Restored build cache from previous deployment(6P2f1prLZSJcMK3E7yp5ynk9yMfW)
        11:06: 45.225 Running "vercel build"
        11:06: 45.240 Vercel CLI 54.9.0
        11:06: 45.519 Installing dependencies...
        11:06: 47.231
        11:06: 47.232 added 3 packages, removed 3 packages, and changed 6 packages in 2s
        11:06: 47.232
        11:06: 47.232 174 packages are looking for funding
11:06: 47.232   run `npm fund` for details
11:06: 47.264 Detected Next.js version: 15.1.9
        11:06: 47.271 Running "npm run build"
        11:06: 47.362
        11:06: 47.362 > arhms@1.0.0 build
        11:06: 47.363 > next build
        11:06: 47.363
        11:06: 48.707    ▲ Next.js 15.1.9
        11:06: 48.707
        11:06: 48.734    Creating an optimized production build ...
        11:06: 49.187  ✓ (pwa) Compiling for server...
        11:06: 49.198  ✓ (pwa) Compiling for server...
        11:06: 49.209  ✓ (pwa) Compiling for client(static)...
        11:06: 49.211  ○ (pwa) Service worker: /vercel/path0 / public / sw.js
        11:06: 49.211  ○ (pwa)   URL: /sw.js
        11:06: 49.211  ○ (pwa)   Scope: /
        11:06: 49.212  ✓ (pwa) Found a custom worker implementation at / vercel / path0 / worker / index.js.
11:06: 49.213  ✓ (pwa) Building the custom worker to / vercel / path0 / public / worker - 67a2984bb79d13b6.js...
        11:07:05.333 < w > [webpack.cache.PackFileCacheStrategy] Serializing big strings(102kiB) impacts deserialization performance(consider using Buffer instead and decode when needed)
        11:07:05.336 < w > [webpack.cache.PackFileCacheStrategy] Serializing big strings(243kiB) impacts deserialization performance(consider using Buffer instead and decode when needed)
        11:07:05.413 < w > [webpack.cache.PackFileCacheStrategy] Serializing big strings(153kiB) impacts deserialization performance(consider using Buffer instead and decode when needed)
        11:07:07.559 Browserslist: browsers data(caniuse - lite) is 6 months old.Please run:
        11:07:07.560   npx update - browserslist - db@latest
        11:07:07.560   Why you should do it regularly: https://github.com/browserslist/update-db#readme
        11:07: 14.065  ⚠ Compiled with warnings
11:07: 14.065
        11:07: 14.066./ node_modules / @supabase / supabase - js / dist / index.mjs
        11:07: 14.066 A Node.js API is used(process.version at line: 27) which is not supported in the Edge Runtime.
11:07: 14.066 Learn more: https://nextjs.org/docs/api-reference/edge-runtime
        11:07: 14.066
        11:07: 14.066 Import trace for requested module:
            11:07: 14.066./ node_modules / @supabase / supabase - js / dist / index.mjs
        11:07: 14.066./ node_modules / @supabase / auth - helpers - shared / dist / index.mjs
        11:07: 14.066./ node_modules / @supabase / auth - helpers - nextjs / dist / index.js
        11:07: 14.066
        11:07: 14.068    Linting and checking validity of types ...
        11:07: 35.715 Failed to compile.
11:07: 35.716
        11:07: 35.716./ app / api / admin / email - broadcast / route.ts: 89: 39
        11:07: 35.716 Type error: Property 'length' does not exist on type 'never'.
11:07: 35.716
        11:07: 35.716   87 |         }
11:07: 35.717   88 |
        11:07: 35.717 > 89 |         if (!recipients || recipients.length === 0) {
            11:07: 35.717 |                                       ^
                11:07: 35.717   90 |             return NextResponse.json({ error: 'No recipients found with valid email addresses' }, { status: 400 })
            11:07: 35.717   91 |         }
    11:07: 35.717   92 |
        11:07: 35.793 Next.js build worker exited with code: 1 and signal: null
    11:07: 35.850 Error: Command "npm run build" exited with 1
    } catch (e) {
    console.error('[OAuthCallback] Error:', e)
    return new NextResponse(
        `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/auth/verify-phone"><script>window.location.href = '/auth/verify-phone';</script></head><body>Redirecting...</body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
    )
}
}
