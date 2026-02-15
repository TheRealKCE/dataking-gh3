import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        // Await params before using
        const { id: userId } = await params

        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '20')
        const offset = parseInt(searchParams.get('offset') || '0')
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
        const { data, error } = await (supabase as any).rpc('get_user_transactions_with_balance', {
            p_user_id: userId,
            p_limit: limit,
            p_offset: offset,
            p_source_filter: source,
            p_type_filter: type, // Pass type filter to RPC
            p_start_date: startDate, // Pass start date to RPC
            p_end_date: endDate // Pass end date to RPC
        })

        if (error) {
            console.error('RPC Error:', error)
            throw new Error(`RPC call failed: ${error.message}`)
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
            .select('balance')
            .eq('user_id', userId)
            .single()

        return NextResponse.json({
            transactions: data || [],
            totalCount: count || 0,
            currentBalance: (walletData as any)?.balance || 0
        })

    } catch (error: any) {
        console.error('Admin User Transactions Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
