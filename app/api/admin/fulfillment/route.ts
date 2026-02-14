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
        const network = searchParams.get('network')
        const status = searchParams.get('status')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const search = searchParams.get('search')
        const limit = parseInt(searchParams.get('limit') || '500')

        // Use service role client to bypass RLS
        const supabase = createServerClient()

        let query = supabase
            .from('orders')
            .select(`
                id, created_at, phone_number, network, size, price, status, user_id,
                users (
                    first_name,
                    last_name,
                    role,
                    email
                ),
                mtn_fulfillment_tracking (
                    status
                )
            `)

        // Filter by pertinent statuses for fulfillment center
        if (status && status !== 'All') {
            query = query.eq('status', status)
        } else {
            query = query.in('status', ['processing', 'failed', 'completed', 'pending'])
        }

        if (network && network !== 'All') {
            query = query.eq('network', network)
        }

        if (startDate) {
            query = query.gte('created_at', startDate)
        }
        if (endDate) {
            query = query.lte('created_at', endDate)
        }

        if (search) {
            query = query.ilike('phone_number', `%${search}%`)
        }

        const { data: orders, error: fetchError } = await query
            .order('created_at', { ascending: false })
            .limit(limit)

        if (fetchError) {
            console.error('[FulfillmentFetch] Error:', fetchError)
            throw fetchError
        }

        return NextResponse.json({
            orders: orders || []
        })
    } catch (error: any) {
        console.error('Fulfillment Orders Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
