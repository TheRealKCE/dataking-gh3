import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { fetchSupplierBalance } from '@/lib/fulfillment-service'

const CACHE_DURATION = 300000 // 5 minutes in milliseconds
let balanceCache: { balance: number; currency: string; timestamp: number } | null = null

export async function GET() {
    try {
        // 1. Authenticate user
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Verify admin role
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        // 3. Check Cache
        const now = Date.now()
        if (balanceCache && (now - balanceCache.timestamp < CACHE_DURATION)) {
            console.log('[DataKazina Balance] Returning cached balance')
            return NextResponse.json({
                balance: balanceCache.balance,
                currency: balanceCache.currency,
                codecraft_balance: (balanceCache as any).codecraft_balance,
                codecraft_currency: (balanceCache as any).codecraft_currency,
                kingflexy_balance: (balanceCache as any).kingflexy_balance,
                kingflexy_currency: (balanceCache as any).kingflexy_currency,
                cached: true
            })
        }

        // 4. Fetch balances from all three suppliers in parallel
        const { fetchSupplierBalance: fetchCodeCraftBalance } = await import('@/lib/codecraft-service')
        const { fetchSupplierBalance: fetchKingFlexyBalance } = await import('@/lib/kingflexy-service')

        const [dakazinaResult, codecraftResult, kingflexyResult] = await Promise.all([
            fetchSupplierBalance(),
            fetchCodeCraftBalance(),
            fetchKingFlexyBalance()
        ])

        if (!dakazinaResult.success && !codecraftResult.success && !kingflexyResult.success) {
            return NextResponse.json({ error: 'Failed to fetch balances from all suppliers' }, { status: 500 })
        }

        // 5. Update Cache
        balanceCache = {
            balance: dakazinaResult.balance || 0,
            currency: dakazinaResult.currency || 'GHS',
            codecraft_balance: codecraftResult.balance || 0,
            codecraft_currency: codecraftResult.currency || 'GHS',
            kingflexy_balance: kingflexyResult.balance || 0,
            kingflexy_currency: kingflexyResult.currency || 'GHS',
            timestamp: now
        } as any

        return NextResponse.json({
            balance: dakazinaResult.balance || 0,
            currency: dakazinaResult.currency || 'GHS',
            codecraft_balance: codecraftResult.balance || 0,
            codecraft_currency: codecraftResult.currency || 'GHS',
            kingflexy_balance: kingflexyResult.balance || 0,
            kingflexy_currency: kingflexyResult.currency || 'GHS',
            cached: false
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
