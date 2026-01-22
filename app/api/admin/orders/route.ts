import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = createRouteHandlerClient({ cookies })
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

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const available = searchParams.get('available') === 'true'
        const batchId = searchParams.get('batchId')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        let query = supabase
            .from('orders')
            .select(`
                *,
                users (
                    first_name,
                    last_name,
                    email
                )
            `)

        if (batchId) {
            query = query.eq('download_batch_id', batchId)
        } else if (available) {
            query = query.is('download_batch_id', null).eq('status', 'pending')
        }

        const { data: orders, error: fetchError } = await query.order('created_at', { ascending: false }).limit(200)

        if (fetchError) {
            console.error('[AdminOrdersFetch] Error:', fetchError)
            throw fetchError
        }

        return NextResponse.json(orders)
    } catch (error: any) {
        console.error('Admin Orders Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
