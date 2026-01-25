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

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Default to last 48 hours to optimize load time
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

        const { data: batches, error: fetchError } = await supabase
            .from('download_batches')
            .select('*')
            .gte('created_at', fortyEightHoursAgo)
            .order('created_at', { ascending: false })

        if (fetchError) {
            console.error('[AdminBatchesFetch] Error:', fetchError)
            throw fetchError
        }

        return NextResponse.json(batches)
    } catch (error: any) {
        console.error('Admin Batches Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
