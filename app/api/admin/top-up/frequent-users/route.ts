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
        const { searchParams } = new URL(request.url)
        const role = searchParams.get('role') || 'agent'

        // Get top 5 most frequently admin-topped users
        let txQuery = supabase
            .from('wallet_transactions')
            .select('user_id, amount, created_at')
            .eq('source', 'admin')
            .eq('type', 'credit')

        const { data: transactions } = await (txQuery as any)

        if (!transactions || transactions.length === 0) {
            return NextResponse.json({ users: [] })
        }

        // Aggregate by user_id
        const countMap: Record<string, { count: number; last_topup_at: string; last_amount: number }> = {}
        const txs = (transactions || []) as any[]
        for (const tx of txs) {
            if (!countMap[tx.user_id]) {
                const txData = tx as any
                countMap[txData.user_id] = { count: 0, last_topup_at: txData.created_at, last_amount: txData.amount }
            }
            const txData = tx as any
            countMap[txData.user_id].count++
            if (txData.created_at > countMap[txData.user_id].last_topup_at) {
                countMap[txData.user_id].last_topup_at = txData.created_at
                countMap[txData.user_id].last_amount = txData.amount
            }
        }

        // Sort by count desc, take top 20 to filter by role after
        const topUserIds = Object.entries(countMap)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 20)
            .map(([id]) => id)

        if (topUserIds.length === 0) {
            return NextResponse.json({ users: [] })
        }

        // Fetch user details + wallets
        let usersQuery = supabase
            .from('users')
            .select(`
                id,
                first_name,
                last_name,
                phone_number,
                role,
                wallets(balance)
            `)
            .in('id', topUserIds)

        if (role && role !== 'all') {
            usersQuery = usersQuery.eq('role', role)
        }

        const { data: users, error } = await (usersQuery as any)

        if (error) throw error

        // Fetch pending debts for these users
        const { data: debts } = await (supabase
            .from('pending_settlements')
            .select('user_id, amount_owed, amount_settled')
            .in('user_id', topUserIds)
            .in('status', ['pending', 'partially_settled']) as any)

        const debtMap: Record<string, number> = {}
        for (const d of (debts ?? []) as any[]) {
            debtMap[d.user_id] = (debtMap[d.user_id] || 0) + (d.amount_owed - d.amount_settled)
        }

        // Enrich and sort by frequency
        const enriched = (users ?? [])
            .map((u: any) => ({
                id: u.id,
                first_name: u.first_name,
                last_name: u.last_name,
                phone_number: u.phone_number,
                role: u.role,
                wallet_balance: u.wallets?.balance ?? 0,
                topup_count: countMap[u.id]?.count ?? 0,
                last_topup_at: countMap[u.id]?.last_topup_at ?? null,
                last_topup_amount: countMap[u.id]?.last_amount ?? null,
                pending_debt_total: debtMap[u.id] ?? 0
            }))
            .sort((a: any, b: any) => b.topup_count - a.topup_count)
            .slice(0, 5)

        return NextResponse.json({ users: enriched })

    } catch (error: any) {
        console.error('[Frequent Users] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
