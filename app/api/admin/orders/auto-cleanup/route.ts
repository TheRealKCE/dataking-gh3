import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * Auto-cleanup endpoint for failed orders older than 48 hours
 * This should be called by a cron job or scheduled task
 */
export async function POST(request: NextRequest) {
    try {
        // Verify this is a cron request (you can add auth token here if needed)
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET || 'your-secret-key'

        // Optional: Uncomment to require auth for cron jobs
        // if (authHeader !== `Bearer ${cronSecret}`) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        // }

        const supabase = createServerClient()

        // Calculate cutoff time (48 hours ago)
        const cutoffTime = new Date()
        cutoffTime.setHours(cutoffTime.getHours() - 48)
        const cutoffISO = cutoffTime.toISOString()

        console.log(`[AutoCleanup] Checking for failed orders older than: ${cutoffISO}`)

        // 1. Find all failed orders older than 48 hours
        const { data: oldFailedOrders, error: fetchError } = await supabase
            .from('orders')
            .select('id, user_id, status, created_at, download_batch_id')
            .eq('status', 'failed')
            .lt('created_at', cutoffISO)

        if (fetchError) throw fetchError

        if (!oldFailedOrders || oldFailedOrders.length === 0) {
            console.log('[AutoCleanup] No old failed orders found')
            return NextResponse.json({
                success: true,
                message: 'No old failed orders to clean up',
                deletedCount: 0
            })
        }

        const orderIds = oldFailedOrders.map((o: any) => o.id)
        const batchIds = [...new Set(oldFailedOrders.map((o: any) => o.download_batch_id).filter(Boolean))]

        console.log(`[AutoCleanup] Found ${oldFailedOrders.length} failed orders to delete`)

        // 2. Delete the old failed orders
        const { error: deleteError } = await supabase
            .from('orders')
            .delete()
            .in('id', orderIds)

        if (deleteError) throw deleteError

        // 3. Clean up empty batches
        let deletedBatches = 0
        for (const batchId of batchIds) {
            // Check if batch still has orders
            const { data: remainingOrders } = await supabase
                .from('orders')
                .select('id')
                .eq('download_batch_id', batchId)
                .limit(1)

            if (!remainingOrders || remainingOrders.length === 0) {
                // Delete empty batch
                const { error: batchDeleteError } = await supabase
                    .from('download_batches')
                    .delete()
                    .eq('id', batchId)

                if (!batchDeleteError) {
                    deletedBatches++
                }
            }
        }

        console.log(`[AutoCleanup] Deleted ${oldFailedOrders.length} orders and ${deletedBatches} empty batches`)

        return NextResponse.json({
            success: true,
            deletedCount: oldFailedOrders.length,
            deletedBatches: deletedBatches,
            message: `Cleaned up ${oldFailedOrders.length} failed order(s) older than 48 hours`
        })
    } catch (error: any) {
        console.error('Auto-cleanup Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// Allow GET requests to manually trigger cleanup (for testing)
export async function GET(request: NextRequest) {
    return POST(request)
}
