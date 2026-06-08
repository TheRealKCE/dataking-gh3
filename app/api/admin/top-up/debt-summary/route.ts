import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await (supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
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
