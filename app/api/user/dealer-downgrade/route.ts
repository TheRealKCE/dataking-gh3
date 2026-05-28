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

        const { data: dbUser } = await supabase
            .from('users')
            .select('role, dealer_expires_at')
            .eq('id', authUser.id)
            .single()

        if (!dbUser || (dbUser as any).role !== 'dealer') {
            return NextResponse.json({ error: 'User is not a dealer' }, { status: 400 })
        }

        const expiresAt = (dbUser as any).dealer_expires_at
        if (expiresAt && new Date(expiresAt) > new Date()) {
            return NextResponse.json({ error: 'Dealer subscription is still active' }, { status: 400 })
        }

        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({
                role: 'customer',
                updated_at: new Date().toISOString(),
            })
            .eq('id', authUser.id)

        if (updateError) {
            console.error('[DealerDowngrade] Update error:', updateError)
            return NextResponse.json({ error: 'Failed to downgrade' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[DealerDowngrade] Exception:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
