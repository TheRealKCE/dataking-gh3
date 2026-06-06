import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const cookiesToSet: Array<{
      name: string
      value: string
      options?: Parameters<NextResponse['cookies']['set']>[2]
    }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(newCookies) {
            cookiesToSet.push(...newCookies)
          },
        },
      }
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Password users already have a public.users row in the current schema,
    // including a non-null phone_number. Avoid an extra RLS-sensitive profile
    // query here; the dashboard middleware remains the source of truth for any
    // exceptional incomplete-profile redirects.
    const response = NextResponse.json({ user: data.user, session: data.session, redirectTo: '/dashboard' })

    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
