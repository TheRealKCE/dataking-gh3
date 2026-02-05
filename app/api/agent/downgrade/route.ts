import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
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

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Fetch current user data
        const { data: user, error: fetchError } = await (supabase
            .from('users') as any)
            .select('id, role, agent_expires_at')
            .eq('id', session.user.id)
            .single()

        if (fetchError || !user) {
            console.error('[AgentDowngrade] User fetch error:', fetchError)
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Verify user is currently an agent
        if (user.role !== 'agent') {
            return NextResponse.json({ error: 'User is not an agent' }, { status: 400 })
        }

        // Update user role to customer and clear agent_expires_at
        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({
                role: 'customer',
                agent_expires_at: null
            })
            .eq('id', session.user.id)

        if (updateError) {
            console.error('[AgentDowngrade] Update error:', updateError)
            throw updateError
        }

        console.log(`[AgentDowngrade] User ${session.user.id} downgraded to customer`)

        return NextResponse.json({
            success: true,
            message: 'Successfully returned to customer role'
        })
    } catch (error: any) {
        console.error('Agent Downgrade Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
