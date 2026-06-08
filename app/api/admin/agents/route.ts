import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
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

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Add timeout to prevent hanging queries
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database query timeout')), 10000)
        )

        const fetchPromise = supabase
            .from('users')
            .select(`
                id,
                email,
                first_name,
                last_name,
                phone_number,
                role,
                status,
                agent_expires_at,
                created_at,
                updated_at
            `)
            .eq('role', 'agent')
            .order('created_at', { ascending: false })

        const { data: agents, error: fetchError } = await Promise.race([
            fetchPromise,
            timeoutPromise
        ]) as any

        if (fetchError) {
            console.error('[AdminAgentsFetch] Database error:', fetchError)
            throw new Error(`Database query failed: ${fetchError.message}`)
        }

        console.log('[AdminAgentsFetch] Successfully fetched', agents?.length || 0, 'agents')

        return NextResponse.json(agents || [])
    } catch (error: any) {
        console.error('Admin Agents Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
