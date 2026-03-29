import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

function getDateRange(filter: string): { start: string; end: string } | null {
    const now = new Date()
    const toIso = (d: Date) => d.toISOString()

    if (filter === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0)
        const end = new Date(now); end.setHours(23, 59, 59, 999)
        return { start: toIso(start), end: toIso(end) }
    }
    if (filter === 'yesterday') {
        const d = new Date(now); d.setDate(d.getDate() - 1)
        const start = new Date(d); start.setHours(0, 0, 0, 0)
        const end = new Date(d); end.setHours(23, 59, 59, 999)
        return { start: toIso(start), end: toIso(end) }
    }
    if (filter === 'this_week') {
        const start = new Date(now); start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0)
        const end = new Date(now); end.setHours(23, 59, 59, 999)
        return { start: toIso(start), end: toIso(end) }
    }
    if (filter === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = new Date(now); end.setHours(23, 59, 59, 999)
        return { start: toIso(start), end: toIso(end) }
    }
    return null // 'all'
}

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()
        if (sessionError || !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: userData } = await supabaseUserClient.from('users').select('role').eq('id', session.user.id).single()
        if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const supabase = createServerClient() as any
        const { searchParams } = new URL(request.url)
        const filter = searchParams.get('filter') || 'today'
        const dateRange = getDateRange(filter)

        let query = supabase
            .from('wallet_transactions')
            .select('id, user_id, amount, description, source, status, created_at')
            .eq('source', 'admin')
            .eq('type', 'credit')
            .order('created_at', { ascending: false })

        if (dateRange) {
            query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end)
        }

        const { data: transactions, error } = await query

        if (error) throw error
        if (!transactions || (transactions as any[]).length === 0) {
            return NextResponse.json({ transactions: [], totalCredited: 0, totalCount: 0 })
        }

        // Enrich with user info
        const userIds = [...new Set((transactions as any[]).map((t: any) => t.user_id))]
        const { data: users } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone_number, role')
            .in('id', userIds)

        const userMap: Record<string, any> = {}
        for (const u of (users || []) as any[]) userMap[u.id] = u

        // Check if each transaction has a linked pending_settlement (unpaid)
        const txIds = (transactions as any[]).map((t: any) => t.id)
        const { data: linkedDebts } = await supabase
            .from('pending_settlements')
            .select('wallet_transaction_id, status, amount_owed, amount_settled')
            .in('wallet_transaction_id', txIds)

        const debtMap: Record<string, any> = {}
        for (const d of (linkedDebts || []) as any[]) debtMap[d.wallet_transaction_id] = d

        const enriched = (transactions as any[]).map((tx: any) => ({
            ...tx,
            first_name: userMap[tx.user_id]?.first_name ?? 'Unknown',
            last_name: userMap[tx.user_id]?.last_name ?? '',
            phone_number: userMap[tx.user_id]?.phone_number ?? '',
            role: userMap[tx.user_id]?.role ?? 'unknown',
            linked_debt: debtMap[tx.id] || null,
        }))

        const totalCredited = enriched.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)

        return NextResponse.json({ transactions: enriched, totalCredited, totalCount: enriched.length })
    } catch (error: any) {
        console.error('[Credits History] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
