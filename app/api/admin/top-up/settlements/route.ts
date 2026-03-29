import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
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

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = createServerClient() as any

        const { data: settlements, error } = await supabase
            .from('pending_settlements')
            .select('id, user_id, amount_owed, amount_settled, status, notes, created_at, settled_at, payment_method')
            .in('status', ['pending', 'partially_settled'])
            .order('created_at', { ascending: true })

        if (error) throw error

        if (!settlements || settlements.length === 0) {
            return NextResponse.json({ settlements: [] })
        }

        // Fetch user info for each settlement
        const userIds = [...new Set((settlements as any[]).map((s: any) => s.user_id))]
        const { data: users } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone_number')
            .in('id', userIds)

        const userMap: Record<string, any> = {}
        for (const u of users ?? []) userMap[u.id] = u

        const enriched = (settlements as any[]).map((s: any) => ({
            ...s,
            remaining: s.amount_owed - s.amount_settled,
            first_name: userMap[s.user_id]?.first_name ?? 'Unknown',
            last_name: userMap[s.user_id]?.last_name ?? '',
            phone_number: userMap[s.user_id]?.phone_number ?? '',
        }))

        return NextResponse.json({ settlements: enriched })

    } catch (error: any) {
        console.error('[Settlements List] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
