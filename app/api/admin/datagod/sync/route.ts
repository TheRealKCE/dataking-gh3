import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { checkDataGodOrderStatus } from '@/lib/datagod-service'

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { orderIds } = body

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return NextResponse.json({ error: 'No order IDs provided' }, { status: 400 })
        }

        const supabase = createServerClient()
        
        // Fetch the tracking records to get the references
        // We only want orders where they have a datagod tracking history
        const { data: ordersWithTracking, error: fetchError } = await supabase
            .from('orders')
            .select(`
                id, 
                status,
                mtn_fulfillment_tracking!inner (
                    id,
                    api_response
                )
            `)
            .in('id', orderIds)
            .contains('mtn_fulfillment_tracking.api_response', { supplier: 'datagod' })

        if (fetchError) {
            console.error('[DataGod Sync] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch tracking details' }, { status: 500 })
        }

        if (!ordersWithTracking || ordersWithTracking.length === 0) {
            return NextResponse.json({ error: 'No valid DataGod orders found to sync.' }, { status: 400 })
        }

        let updatedCount = 0
        let unchangedCount = 0
        let failedCount = 0
        const results = []

        for (const order of (ordersWithTracking as any[])) {
            // Find the datagod tracking record with the reference
            const datagodTracking = order.mtn_fulfillment_tracking.find(
                (t: any) => t.api_response?.supplier === 'datagod' && t.api_response?.reference
            )

            if (!datagodTracking) {
                failedCount++
                results.push({ id: order.id, error: 'No DataGod reference found in tracking history' })
                continue
            }

            const reference = datagodTracking.api_response.reference
            console.log(`[DataGod Sync] Checking order: ${order.id} | Ref: ${reference}`)

            const result = await checkDataGodOrderStatus(reference)

            if (result.success) {
                const newStatus = result.status
                // ONLY fetch without updating per user request
                updatedCount++
                results.push({ id: order.id, success: true, status: newStatus, raw: result.data || result })
            } else {
                failedCount++
                console.error(`[DataGod Sync Debug] API Check failed for ${reference}:`, result)
                results.push({ id: order.id, success: false, error: result.message, raw: result })
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sync complete: ${updatedCount} fetched, ${failedCount} failed`,
            updated: updatedCount,
            unchanged: unchangedCount,
            failed: failedCount,
            results
        })

    } catch (error: any) {
        console.error('DataGod Sync Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
