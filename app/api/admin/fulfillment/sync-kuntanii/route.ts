import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { reconcileKuntaniiOrders } from '@/lib/kuntanii-reconcile'

// Manual twin of app/api/cron/sync-kuntanii-status, for the "Kuntanii Status Sync"
// button in the admin Fulfillment Center. Not gated on CRON_JOBS_ENABLED.

export const maxDuration = 60

export async function POST() {
    try {
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: userData } = await (supabase.from('users') as any).select('role').eq('id', authUser.id).single()
        if (!userData || userData.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

        return NextResponse.json(await reconcileKuntaniiOrders())
    } catch (error: any) {
        console.error('[SyncKuntanii] Unhandled error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
