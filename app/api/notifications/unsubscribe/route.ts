import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        const supabaseUser = await createRouteHandlerClient()
        const { data: { user } } = await supabaseUser.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { endpoint } = await req.json()

        if (!endpoint) {
            return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
        }

        const supabase = createServerClient()

        await (supabase.from('push_subscriptions') as any)
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint)

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
