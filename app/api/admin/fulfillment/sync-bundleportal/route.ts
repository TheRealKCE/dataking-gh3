import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { reconcileBundlePortalOrders } from '@/lib/bundleportal-reconcile'

// Manual twin of app/api/cron/sync-bundleportal-status, for the "Status Sync"
// button in the admin Fulfillment Center. Same logic, via lib/bundleportal-reconcile.
// Not gated on CRON_JOBS_ENABLED — an admin asking explicitly should always get a run.

export const maxDuration = 60

export async function POST() {
    try {
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // `as any`: the generated Supabase types resolve this select to `never`.
        const { data: userData } = await (supabase.from('users') as any).select('role').eq('id', authUser.id).single()
        if (!userData || userData.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

        return NextResponse.json(await reconcileBundlePortalOrders())
    } catch (error: any) {
        console.error('[SyncBundlePortal] Unhandled error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
