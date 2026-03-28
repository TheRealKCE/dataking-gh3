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

        const { data: userData } = await (supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single() as any)

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = createServerClient()

        const { data: debts } = await (supabase
            .from('pending_settlements')
            .select('amount_owed, amount_settled, user_id')
            .in('status', ['pending', 'partially_settled']) as any)

        const totalOwed = debts?.reduce((sum: number, d: any) => sum + (d.amount_owed - d.amount_settled), 0) ?? 0
        const uniqueUsers = new Set(debts?.map((d: any) => d.user_id) ?? [])

        return NextResponse.json({
            totalOwed,
            pendingUsersCount: uniqueUsers.size
        })

    } catch (error: any) {
        console.error('[Debt Summary] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
