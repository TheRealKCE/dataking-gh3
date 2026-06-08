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

        const body = await req.json()
        const { endpoint, keys } = body

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
        }

        const supabase = createServerClient()

        await (supabase.from('push_subscriptions') as any)
            .upsert(
                {
                    user_id: user.id,
                    endpoint,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,endpoint' }
            )

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
