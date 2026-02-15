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
        if (type && type !== 'all') {
            query = query.eq('type', type)
        }

        if (source && source !== 'all') {
            query = query.eq('source', source)
        }

        if (startDate) {
            query = query.gte('created_at', startDate)
        }

        if (endDate) {
            // Add time to end date to make it inclusive of the day
            // But usually client sends ISO string. If just YYYY-MM-DD, append time.
            let endISO = endDate
            if (!endDate.includes('T')) {
                endISO = `${endDate}T23:59:59`
            }
            query = query.lte('created_at', endISO)
        }

        const { data: transactions, count, error: fetchError } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (fetchError) {
            throw new Error(`Database query failed: ${fetchError.message}`)
        }

        return NextResponse.json({
            transactions: transactions || [],
            totalCount: count || 0
        })

    } catch (error: any) {
        console.error('Admin User Transactions Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
