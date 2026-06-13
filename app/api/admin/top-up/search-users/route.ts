import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
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
        const q = searchParams.get('q') || ''
        const role = searchParams.get('role') || 'all'
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

        // Base query: users joined with wallets
        let query = supabase
            .from('wallets')
            .select(`
                balance,
                users!inner (
                    id,
                    first_name,
                    last_name,
                    phone_number,
                    email,
                    role
                )
            `)
            .limit(limit)

        // Apply role filter
        if (role && role !== 'all') {
            query = query.eq('users.role', role)
        }

        // Apply search filter
        if (q) {
            query = query.or(
                `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone_number.ilike.%${q}%,email.ilike.%${q}%`,
                { foreignTable: 'users' }
            )
        }

        const { data: wallets, error } = await (query as any)

        if (error) throw error

        // Enrich each user with last admin top-up + pending debt
        const enriched = await Promise.all(
            (wallets ?? []).map(async (w: any) => {
                const user = w.users

                // Last admin top-up
                const { data: lastTopup } = await (supabase
                    .from('wallet_transactions')
                    .select('amount, created_at')
                    .eq('user_id', user.id)
                    .eq('source', 'admin')
                    .eq('type', 'credit')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle() as any)

                // Pending debt total
                const { data: debts } = await (supabase
                    .from('pending_settlements')
                    .select('amount_owed, amount_settled')
                    .eq('user_id', user.id)
                    .in('status', ['pending', 'partially_settled']) as any)

                const pendingDebtTotal = ((debts || []) as any[]).reduce((sum: number, d: any) => sum + (d.amount_owed - d.amount_settled), 0)

                return {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    phone_number: user.phone_number,
                    email: user.email,
                    role: user.role,
                    wallet_balance: w.balance,
                    last_admin_topup_at: (lastTopup as any)?.created_at ?? null,
                    last_admin_topup_amount: (lastTopup as any)?.amount ?? null,
                    pending_debt_total: pendingDebtTotal
                }
            })
        )

        return NextResponse.json({ users: enriched })

    } catch (error: any) {
        console.error('[Search Users] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
