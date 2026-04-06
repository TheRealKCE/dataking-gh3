import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = createServerClient()

        const { data: debts, error } = await (supabase
            .from('pending_settlements')
            .select('id, amount_owed, amount_settled, status, notes, created_at')
            .eq('user_id', userId)
            .in('status', ['pending', 'partially_settled'])
            .order('created_at', { ascending: true }) as any)

        if (error) throw error

        const debtsArr = (debts || []) as any[]
        const enrichedDebts = debtsArr.map((d: any) => ({
            ...d,
            remaining: d.amount_owed - d.amount_settled
        }))

        const totalRemaining = enrichedDebts.reduce((sum: number, d: any) => sum + d.remaining, 0)

        return NextResponse.json({
            debts: enrichedDebts,
            totalRemaining
        })

    } catch (error: any) {
        console.error('[User Debt] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
