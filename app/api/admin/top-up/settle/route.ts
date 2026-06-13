import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

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
        const { settlementId, paymentAmount, paymentMethod, notes } = body

        if (!settlementId || !paymentAmount || paymentAmount <= 0) {
            return NextResponse.json({ error: 'settlementId and paymentAmount > 0 are required' }, { status: 400 })
        }

        const supabase = createServerClient() as any

        // Fetch current settlement record
        const { data: settlement, error: fetchError } = await supabase
            .from('pending_settlements')
            .select('id, amount_owed, amount_settled, status')
            .eq('id', settlementId)
            .single()

        if (fetchError || !settlement) {
            return NextResponse.json({ error: 'Settlement record not found' }, { status: 404 })
        }

        const s = settlement as any
        if (s.status === 'settled') {
            return NextResponse.json({ error: 'This debt has already been fully settled' }, { status: 400 })
        }

        const newAmountSettled = (s.amount_settled || 0) + paymentAmount
        const isFullySettled = newAmountSettled >= s.amount_owed
        const remaining = Math.max(0, s.amount_owed - newAmountSettled)

        const { error: updateError } = await supabase
            .from('pending_settlements')
            .update({
                amount_settled: Math.min(newAmountSettled, s.amount_owed),
                status: isFullySettled ? 'settled' : 'partially_settled',
                settled_at: isFullySettled ? new Date().toISOString() : null,
                payment_method: paymentMethod || null,
                notes: notes || null
            })
            .eq('id', settlementId)

        if (updateError) throw updateError

        return NextResponse.json({
            success: true,
            isFullySettled,
            remaining
        })

    } catch (error: any) {
        console.error('[Settle] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
