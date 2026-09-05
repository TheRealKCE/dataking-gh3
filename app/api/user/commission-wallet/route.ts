import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'

/**
 * Commission wallet for the dashboard.
 *
 * /api/v2/commission/balance answers the same question but authenticates with a
 * Commission Services key, which the browser does not have — the key is shown once
 * and never stored. This is the session-authenticated twin.
 */
export async function GET() {
    try {
        const supabaseUser = await createRouteHandlerClient()
        const { data: { user }, error } = await supabaseUser.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()

        const { data: wallet } = await (supabase.from('commission_wallets') as any)
            .select('balance, total_earned, total_withdrawn')
            .eq('owner_id', user.id)
            .maybeSingle()

        const { data: recent } = await (supabase.from('commission_transactions') as any)
            .select('id, source, amount, description, reference, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)

        // No row until the first earning — report zero rather than 404.
        return NextResponse.json({
            success: true,
            wallet: {
                balance:         Number((wallet as any)?.balance ?? 0),
                total_earned:    Number((wallet as any)?.total_earned ?? 0),
                total_withdrawn: Number((wallet as any)?.total_withdrawn ?? 0),
                currency:        'GHS',
            },
            transactions: (recent as any[]) || [],
        })
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
