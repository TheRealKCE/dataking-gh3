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
        const role = searchParams.get('role')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // We need to sum columns. 
        // Queries with JOINs and SUMs can be tricky with Supabase JS client directly if we want efficient aggregation.
        // But we can fetch just the columns needed and reduce in memory if valid for dataset size, 
        // OR use a raw RPC call if we had one.
        // OR use .select('balance, users!inner(role)') and iterate.
        // For performance with potentially thousands of users, fetching all rows to sum in JS is bad.
        // However, Supabase/PostgREST doesn't support aggregate functions easily without RPC.
        // Let's check if we can use .select('balance.sum()') - No, that's not standard Supabase JS.

        // STANDARD APPROACH WITHOUT RPC:
        // We have to paginate through all or assume dataset is small enough (limit 1000?). 
        // If dataset is massive, RPC is mandatory for 'sum'.
        // Let's assume for this project scope (thousands of users), fetching just 'balance' column is okay-ish, 
        // but let's try to be smarter.

        // actually, we can't do aggregates easily. 
        // Let's write a loop to fetch in chunks if we have to, or just fetch all 'id, balance' entries. 
        // Fetching 10,000 integers is very lightweight (approx 100KB payload).

        let query = supabase
            .from('wallets')
            .select(`
                balance,
                total_credited,
                total_spent,
                users!inner (
                    role
                )
            `)

        if (role && role !== 'all') {
            query = query.eq('users.role', role)
        }

        const { data: wallets, error: fetchError } = await query

        if (fetchError) {
            throw new Error(`Database query failed: ${fetchError.message}`)
        }

        // Calculate totals in memory (fast enough for <50k records)
        let totalBalance = 0
        let totalCredited = 0
        let totalSpent = 0

        wallets?.forEach((wallet: any) => {
            totalBalance += wallet.balance || 0
            totalCredited += wallet.total_credited || 0
            totalSpent += wallet.total_spent || 0
        })

        return NextResponse.json({
            totalBalance,
            totalCredited,
            totalSpent,
            count: wallets?.length || 0
        })

    } catch (error: any) {
        console.error('Admin Finance Stats Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
