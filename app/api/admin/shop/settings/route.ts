import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })

        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()
        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify caller is an admin
        const { data: callerUser } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (!callerUser || callerUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { rows } = body

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
        }

        // Use service role client — bypasses RLS so the upsert is allowed.
        // The admin identity has been verified above before reaching this point.
        const supabase = createServerClient()
        const { error } = await (supabase as any)
            .from('shop_global_settings')
            .upsert(rows, { onConflict: 'key' })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[AdminGlobalSettings API]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
