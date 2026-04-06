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
                cached: true
            })
        }

        // 4. Fetch balance from DataKazina
        const result = await fetchSupplierBalance()

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        // 5. Update Cache
        balanceCache = {
            balance: result.balance || 0,
            currency: result.currency || 'GHS',
            timestamp: now
        }

        return NextResponse.json({
            balance: result.balance,
            currency: result.currency,
            cached: false
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
