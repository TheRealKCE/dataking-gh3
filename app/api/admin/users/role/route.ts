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

        // Check if requester is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, role } = body

        if (!userId || !role) {
            return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Calculate expiration if role is agent
        const updateData: any = { role }
        if (role === 'agent') {
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 30)
            updateData.agent_expires_at = expiresAt.toISOString()
        } else {
            updateData.agent_expires_at = null
        }

        const { error: updateError } = await (supabase
            .from('users') as any)
            .update(updateData)
            .eq('id', userId)

        if (updateError) {
            console.error('[AdminRoleUpdate] Update error:', updateError)
            throw updateError
        }

        return NextResponse.json({
            success: true,
            userId,
            newRole: role
        })
    } catch (error: any) {
        console.error('Admin Role Update Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
