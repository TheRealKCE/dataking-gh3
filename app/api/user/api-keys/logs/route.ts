import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
    try {
        const cookieStore = await cookies()
        const supabaseUser = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore,
        })
        const { data: { user }, error } = await supabaseUser.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()

        const { data: logs } = await (supabase.from('api_logs') as any)
            .select('id, endpoint, method, status_code, response_time_ms, ip_address, error_message, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)

        return NextResponse.json({ success: true, data: { logs: logs || [] } })
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
