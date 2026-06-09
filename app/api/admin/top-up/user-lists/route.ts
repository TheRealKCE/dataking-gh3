import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

async function getAdminSupabase() {
    const cookieStore = await cookies()
    const supabaseUserClient = createRouteHandlerClient({
        // @ts-expect-error - auth-helpers types
        cookies: () => cookieStore
    })
    const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
    if (authError || !authUser) return { error: 'Unauthorized', status: 401 }
    const { data: userData } = await supabaseUserClient.from('users').select('role').eq('id', authUser.id).single()
    if (userData?.role !== 'admin') return { error: 'Forbidden', status: 403 }
    return { authUser, supabase: createServerClient() as any, supabaseUserClient }
}

// GET — Fetch all custom lists with their member user details
export async function GET(request: NextRequest) {
    try {
        const auth = await getAdminSupabase()
        if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
        const { supabase } = auth

        const { data: lists, error } = await supabase
            .from('admin_custom_lists')
            .select('id, name, created_at')
            .order('created_at', { ascending: true })

        if (error) throw error

        const enrichedLists = await Promise.all(
            ((lists || []) as any[]).map(async (list: any) => {
                const { data: members } = await supabase
                    .from('admin_custom_list_users')
                    .select('user_id, added_at')
                    .eq('list_id', list.id)

                const userIds = ((members || []) as any[]).map((m: any) => m.user_id)

                let users: any[] = []
                if (userIds.length > 0) {
                    const { data: userDetails } = await supabase
                        .from('users')
                        .select('id, first_name, last_name, phone_number, role')
                        .in('id', userIds)

                    const walletResults = await Promise.all(
                        ((userDetails || []) as any[]).map(async (u: any) => {
                            const { data: wallet } = await supabase
                                .from('wallets')
                                .select('balance')
                                .eq('user_id', u.id)
                                .single()
                            const { data: debts } = await supabase
                                .from('pending_settlements')
                                .select('amount_owed, amount_settled')
                                .eq('user_id', u.id)
                                .in('status', ['pending', 'partially_settled'])
                            const pendingDebtTotal = ((debts || []) as any[]).reduce(
                                (sum: number, d: any) => sum + (d.amount_owed - d.amount_settled), 0
                            )
                            return {
                                ...u,
                                wallet_balance: (wallet as any)?.balance || 0,
                                pending_debt_total: pendingDebtTotal,
                                last_admin_topup_at: null,
                                last_admin_topup_amount: null,
                            }
                        })
                    )
                    users = walletResults
                }

                return { ...list, users }
            })
        )

        return NextResponse.json({ lists: enrichedLists })
    } catch (error: any) {
        console.error('[User Lists GET] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// POST — Create list, or add/remove user from list
export async function POST(request: NextRequest) {
    try {
        const auth = await getAdminSupabase()
        if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
        const { supabase, authUser } = auth

        const body = await request.json()
        const { action, listId, listName, userId } = body

        if (action === 'create') {
            if (!listName?.trim()) return NextResponse.json({ error: 'List name is required' }, { status: 400 })
            const { data: newList, error } = await supabase
                .from('admin_custom_lists')
                .insert({ name: listName.trim(), created_by: authUser.id })
                .select('id, name, created_at')
                .single()
            if (error) throw error
            return NextResponse.json({ list: newList })
        }

        if (action === 'add') {
            if (!listId || !userId) return NextResponse.json({ error: 'listId and userId required' }, { status: 400 })
            const { error } = await supabase
                .from('admin_custom_list_users')
                .insert({ list_id: listId, user_id: userId })
            if (error && error.code !== '23505') throw error // 23505 = unique violation (already added)
            return NextResponse.json({ success: true })
        }

        if (action === 'remove') {
            if (!listId || !userId) return NextResponse.json({ error: 'listId and userId required' }, { status: 400 })
            const { error } = await supabase
                .from('admin_custom_list_users')
                .delete()
                .eq('list_id', listId)
                .eq('user_id', userId)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        if (action === 'delete') {
            if (!listId) return NextResponse.json({ error: 'listId required' }, { status: 400 })
            const { error } = await supabase
                .from('admin_custom_lists')
                .delete()
                .eq('id', listId)
            if (error) throw error
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (error: any) {
        console.error('[User Lists POST] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
