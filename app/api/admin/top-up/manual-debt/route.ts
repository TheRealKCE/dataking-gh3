import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types
            cookies: () => cookieStore
        })
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
        if (authError || !authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: userData } = await supabaseUserClient.from('users').select('role').eq('id', authUser.id).single()
        if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const body = await request.json()
        const { userId, amount, notes, linkedTransactionId } = body

        if (!userId || !amount || amount <= 0) {
            return NextResponse.json({ error: 'userId and amount > 0 are required' }, { status: 400 })
        }

        // Verify user exists
        const supabase = createServerClient() as any
        const { data: userRecord } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .eq('id', userId)
            .single()

        if (!userRecord) return NextResponse.json({ error: 'User not found' }, { status: 404 })

        // If linked to a transaction, verify it isn't already tracked as unpaid
        if (linkedTransactionId) {
            const { data: existing } = await supabase
                .from('pending_settlements')
                .select('id')
                .eq('wallet_transaction_id', linkedTransactionId)
                .limit(1)
            if (existing && (existing as any[]).length > 0) {
                return NextResponse.json({
                    error: 'This transaction already has a linked debt record. Check the Settlements tab.'
                }, { status: 409 })
            }
        }

        // Insert the manual debt record (wallet balance NOT touched)
        const { data: newDebt, error: insertError } = await supabase
            .from('pending_settlements')
            .insert({
                user_id: userId,
                wallet_transaction_id: linkedTransactionId || null,
                amount_owed: amount,
                amount_settled: 0,
                status: 'pending',
                notes: notes ? `[Manual Debt] ${notes}` : '[Manual Debt — Retroactive]',
            })
            .select('id')
            .single()

        if (insertError) throw insertError

        return NextResponse.json({ success: true, debtId: (newDebt as any).id })
    } catch (error: any) {
        console.error('[Manual Debt] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
