import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'

// Temporary diagnostic endpoint — remove after confirming env vars on Vercel.
// Accessing this URL on production will show exactly which keys are missing.
export async function GET(request: NextRequest) {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Only allow authenticated users to see this
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check wallet_payments table
    let walletPaymentsOk = false
    let walletPaymentsError = null
    try {
        const { createServerClient } = await import('@/lib/supabase')
        const admin = createServerClient()
        const { error } = await (admin.from('wallet_payments') as any).select('id').limit(1)
        walletPaymentsOk = !error
        walletPaymentsError = error?.message ?? null
    } catch (e: any) {
        walletPaymentsError = e?.message
    }

    return NextResponse.json({
        env: {
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ set' : '❌ MISSING',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ set' : '❌ MISSING',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ MISSING',
            PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY
                ? `✅ set (${process.env.PAYSTACK_SECRET_KEY.substring(0, 12)}...)`
                : '❌ MISSING',
            NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '❌ MISSING',
        },
        database: {
            wallet_payments_table: walletPaymentsOk ? '✅ accessible' : `❌ error: ${walletPaymentsError}`,
        }
    })
}
