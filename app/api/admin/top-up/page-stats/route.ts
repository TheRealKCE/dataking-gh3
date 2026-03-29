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

        const supabase = createServerClient()
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const [
            walletResult,
            usersResult,
            agentsResult,
            customersResult,
            subAdminsResult,
            topupsResult,
            debtResult
        ] = await Promise.all([
            // Total wallet balance across all users
            (supabase.from('wallets').select('balance') as any).then(({ data }: any) => ({
                totalWalletBalance: (data ?? []).reduce((sum: number, w: any) => sum + (w.balance || 0), 0)
            })),

            // Total users
            (supabase.from('users').select('*', { count: 'exact', head: true }) as any).then(({ count }: any) => ({
                totalUsers: count ?? 0
            })),

            // Agents count
            (supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'agent') as any).then(({ count }: any) => ({
                totalAgents: count ?? 0
            })),

            // Customers count
            (supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer') as any).then(({ count }: any) => ({
                totalCustomers: count ?? 0
            })),

            // Sub-admins count
            (supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'subadmin') as any).then(({ count }: any) => ({
                totalSubAdmins: count ?? 0
            })),

            // Admin top-ups today
            (supabase
                .from('wallet_transactions')
                .select('amount')
                .eq('source', 'admin')
                .eq('type', 'credit')
                .gte('created_at', today.toISOString()) as any)
                .then(({ data }: any) => ({
                    totalAdminTopUpsToday: (data ?? []).length,
                    totalCreditedToday: (data ?? []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
                })),

            // Debt summary
            (supabase
                .from('pending_settlements')
                .select('amount_owed, amount_settled, user_id')
                .in('status', ['pending', 'partially_settled']) as any)
                .then(({ data }: any) => {
                    const rows = (data ?? []) as Array<{ amount_owed: number; amount_settled: number; user_id: string }>
                    const totalOwed = rows.reduce((sum, r) => sum + ((r.amount_owed - r.amount_settled) || 0), 0)
                    const uniqueUsers = new Set(rows.map(r => r.user_id))
                    return {
                        totalOwed,
                        pendingDebtUsersCount: uniqueUsers.size
                    }
                })
        ])

        return NextResponse.json({
            ...walletResult,
            ...usersResult,
            ...agentsResult,
            ...customersResult,
            ...subAdminsResult,
            ...topupsResult,
            ...debtResult
        })

    } catch (error: any) {
        console.error('[Top-Up Page Stats] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
