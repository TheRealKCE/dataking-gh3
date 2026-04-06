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
        const limit = parseInt(searchParams.get('limit') || '20')
        const offset = parseInt(searchParams.get('offset') || '0')
        const search = searchParams.get('search')
        const sort = searchParams.get('sort') || 'balance' // Default sort by balance
        const order = searchParams.get('order') || 'desc'
        const ascending = order === 'asc'

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Query WALLETS first to enable easy sorting by financial stats
        let query = supabase
            .from('wallets')
            .select(`
                balance,
                total_credited,
                total_spent,
                users!inner (
                    id,
                    email,
                    first_name,
                    last_name,
                    phone_number,
                    created_at
                )
            `, { count: 'exact' })

        if (search) {
            // Searching on joined table is possible with !inner
            query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone_number.ilike.%${search}%`, { foreignTable: 'users' })
        }

        const role = searchParams.get('role')
        if (role && role !== 'all') {
            query = query.eq('users.role', role)
        }

        // Apply sorting
        if (['balance', 'total_credited', 'total_spent'].includes(sort)) {
            query = query.order(sort, { ascending })
        } else {
            // If sorting by user fields, we might need to fallback or stick to wallet-centric view
            // For now, default to balance desc if valid sort not provided or handle created_at via foreign table?
            // Supabase supports ordering by foreign column:
            // query = query.order('created_at', { foreignTable: 'users', ascending })
            // But simpler to just default to balance for "Finance" view
            query = query.order('balance', { ascending: false })
        }

        const { data: wallets, count, error: fetchError } = await query
            .range(offset, offset + limit - 1)

        if (fetchError) {
            throw new Error(`Database query failed: ${fetchError.message}`)
        }

        // Flatten the structure
        const formattedUsers = wallets?.map((wallet: any) => ({
            id: wallet.users.id,
            first_name: wallet.users.first_name,
            last_name: wallet.users.last_name,
            email: wallet.users.email,
            phone_number: wallet.users.phone_number,
            created_at: wallet.users.created_at,
            wallet_balance: wallet.balance,
            total_credited: wallet.total_credited,
            total_spent: wallet.total_spent,
        })) || []

        return NextResponse.json({
            users: formattedUsers,
            totalCount: count || 0
        })

    } catch (error: any) {
        console.error('Admin Finance Users Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
