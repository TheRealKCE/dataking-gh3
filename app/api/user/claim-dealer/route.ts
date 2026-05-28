import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

        const supabase = createServerClient()

        const { data: dbUser, error: fetchError } = await supabase
            .from('users')
            .select('role, dealer_claimed_at')
            .eq('id', authUser.id)
            .single()

        if (fetchError || !dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if ((dbUser as any).role !== 'customer') {
            return NextResponse.json({ error: 'Only customers can claim the dealership role' }, { status: 400 })
        }

        if ((dbUser as any).dealer_claimed_at) {
            return NextResponse.json({ error: 'Dealership has already been claimed' }, { status: 400 })
        }

        const now = new Date()
        const expiresAt = new Date(now)
        expiresAt.setDate(expiresAt.getDate() + 30)

        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({
                role: 'dealer',
                dealer_claimed_at: now.toISOString(),
                dealer_expires_at: expiresAt.toISOString(),
                updated_at: now.toISOString(),
            })
            .eq('id', authUser.id)

        if (updateError) {
            console.error('[ClaimDealer] Update error:', updateError)
            return NextResponse.json({ error: 'Failed to claim dealership' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Dealership claimed! Enjoy your free 1-month trial.',
            dealer_expires_at: expiresAt.toISOString(),
        })
    } catch (error: any) {
        console.error('[ClaimDealer] Exception:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
