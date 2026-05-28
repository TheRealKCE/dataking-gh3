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
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = createServerClient()

        const { data: dealers, error: fetchError } = await supabase
            .from('users')
            .select(`
                id,
                email,
                first_name,
                last_name,
                phone_number,
                role,
                status,
                dealer_claimed_at,
                dealer_expires_at,
                created_at,
                updated_at
            `)
            .eq('role', 'dealer')
            .order('dealer_expires_at', { ascending: true })

        if (fetchError) {
            console.error('[AdminDealers] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        return NextResponse.json(dealers || [])
    } catch (error: any) {
        console.error('[AdminDealers] Exception:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

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

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, action, days } = body

        if (!userId || !action) {
            return NextResponse.json({ error: 'userId and action are required' }, { status: 400 })
        }

        const supabase = createServerClient()

        const { data: dealer } = await supabase
            .from('users')
            .select('role, dealer_expires_at')
            .eq('id', userId)
            .single()

        if (!dealer || (dealer as any).role !== 'dealer') {
            return NextResponse.json({ error: 'User is not a dealer' }, { status: 400 })
        }

        if (action === 'extend' || action === 'reduce') {
            const numDays = parseInt(days)
            if (isNaN(numDays) || numDays === 0) {
                return NextResponse.json({ error: 'Valid days value required' }, { status: 400 })
            }

            const currentExpiry = (dealer as any).dealer_expires_at
                ? new Date((dealer as any).dealer_expires_at)
                : new Date()

            const newExpiry = new Date(currentExpiry)
            newExpiry.setDate(newExpiry.getDate() + numDays)

            const { error: updateError } = await supabase
                .from('users')
                .update({
                    dealer_expires_at: newExpiry.toISOString(),
                    updated_at: new Date().toISOString(),
                } as any)
                .eq('id', userId)

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                newExpiry: newExpiry.toISOString(),
                isExpired: newExpiry < new Date(),
            })
        }

        if (action === 'revoke') {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    role: 'customer',
                    updated_at: new Date().toISOString(),
                } as any)
                .eq('id', userId)

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 })
            }

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (error: any) {
        console.error('[AdminDealers] POST Exception:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
