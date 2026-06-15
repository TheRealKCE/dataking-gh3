import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Temporary diagnostic endpoint — secured by a secret token.
// Usage: GET /api/payments/check?secret=YOUR_CRON_SECRET
// Remove this file once env vars on Vercel are confirmed.
export async function GET(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret')
    if (!secret || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check wallet_payments table via admin client
    let walletPaymentsOk = false
    let walletPaymentsError: string | null = null
    try {
        const admin = createServerClient()
        const { error } = await (admin.from('wallet_payments') as any).select('id').limit(1)
        walletPaymentsOk = !error
        walletPaymentsError = error?.message ?? null
    } catch (e: any) {
        walletPaymentsError = e?.message ?? 'createServerClient threw — SUPABASE_SERVICE_ROLE_KEY likely missing'
    }

    return NextResponse.json({
        env: {
            NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL      ? '✅ set' : '❌ MISSING',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ set' : '❌ MISSING',
            SUPABASE_SERVICE_ROLE_KEY:     process.env.SUPABASE_SERVICE_ROLE_KEY     ? '✅ set' : '❌ MISSING',
            PAYSTACK_SECRET_KEY:           process.env.PAYSTACK_SECRET_KEY
                ? `✅ set (${process.env.PAYSTACK_SECRET_KEY.substring(0, 12)}...)`
                : '❌ MISSING',
            NEXT_PUBLIC_APP_URL:           process.env.NEXT_PUBLIC_APP_URL           || '❌ MISSING',
        },
        database: {
            wallet_payments_table: walletPaymentsOk
                ? '✅ accessible'
                : `❌ error: ${walletPaymentsError}`,
        },
    })
}
