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

        const { data: users, error: fetchError } = await supabase
            .from('users')
            .select(`
                *,
                wallets (
                    balance
                )
            `)
            .order('created_at', { ascending: false })

        if (fetchError) {
            console.error('[AdminUsersFetch] Error:', fetchError)
            throw fetchError
        }

        if (users && users.length > 0) {
            console.log('[AdminUsersFetch] First user sample:', JSON.stringify(users[0], null, 2))
        }

        return NextResponse.json(users)
    } catch (error: any) {
        console.error('Admin Users Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
