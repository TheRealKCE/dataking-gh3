import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { parsePagination } from '@/lib/pagination'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        // Await params before using
        const { id: userId } = await params

        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const { limit, offset } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 })
        const type = searchParams.get('type') // credit, debit
        const source = searchParams.get('source') // purchase, payment, admin, refund
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        let query = supabase
            .from('wallet_transactions')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
        // Apply filters
        // Note: The 'type' filter is not directly used in the RPC call as the RPC function
        // currently only supports source filtering. If 'type' filtering is needed,
        // it would need to be added to the RPC function or filtered client-side.
        // For now, we'll proceed with the RPC call as specified.

        // Use the new RPC function to get transactions with calculated running balance
        // @ts-ignore - RPC types might not be generated yet
        let { data, error } = await (supabase as any).rpc('get_user_transactions_with_balance', {
            p_user_id: userId,
            p_limit: limit,
            p_offset: offset,
            p_source_filter: source,
            p_type_filter: type,
            p_start_date: startDate,
            p_end_date: endDate
        })

        // FALLBACK: If RPC fails (e.g. function doesn't exist yet), fall back to standard query
        if (error) {
            console.warn('RPC failed, falling back to standard query:', error.message)

            let query = supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', userId)

            if (type && type !== 'all') query = query.eq('type', type)
            if (source && source !== 'all') query = query.eq('source', source)
            if (startDate) query = query.gte('created_at', startDate)
            if (endDate) {
                let endISO = endDate.includes('T') ? endDate : `${endDate}T23:59:59`
                query = query.lte('created_at', endISO)
            }

            const { data: fallbackData, error: fallbackError } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            if (fallbackError) {
                throw new Error(`Fallback query failed: ${fallbackError.message}`)
            }

            data = fallbackData
        }

        // Get total count separately (RPC returns paginated data)
        // Efficient: Just counting rows handling filters
        let countQuery = supabase
            .from('wallet_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)

        if (type && type !== 'all') {
            countQuery = countQuery.eq('type', type)
        }

        if (source && source !== 'all') {
            countQuery = countQuery.eq('source', source)
        }

        if (startDate) {
            countQuery = countQuery.gte('created_at', startDate)
        }

        if (endDate) {
            let endISO = endDate
            if (!endDate.includes('T')) {
                endISO = `${endDate}T23:59:59`
            }
            countQuery = countQuery.lte('created_at', endISO)
        }

        const { count } = await countQuery

        // Fetch current wallet balance (still useful for verification or top-level display)
        const { data: walletData } = await supabase
            .from('wallets')
            .select('balance, total_credited, total_spent')
            .eq('user_id', userId)
            .single()

        // Fetch user details for header display
        const { data: userDetails } = await supabase
            .from('users')
            .select('first_name, last_name, email, phone_number')
            .eq('id', userId)
            .single()

        return NextResponse.json({
            transactions: data || [],
            totalCount: count || 0,
            wallet: walletData || { balance: 0, total_credited: 0, total_spent: 0 },
            user: userDetails || null
        })

    } catch (error: any) {
        console.error('Admin User Transactions Fetch Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
