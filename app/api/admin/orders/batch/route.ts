import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { syncShopOrderStatus } from '@/lib/shop-service'

// Create a service role client to bypass RLS for admin updates functions
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role, first_name')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { orderIds, filename, network, idempotencyKey } = body

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return NextResponse.json({ error: 'Order IDs are required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = supabaseAdmin

        // 0. Check for existing batch with idempotency key
        if (idempotencyKey) {
            const { data: existingBatch } = await supabase
                .from('download_batches')
                .select('id')
                .eq('idempotency_key', idempotencyKey)
                .single()

            if (existingBatch) {
                console.log('[AdminBatchCreate] Returning existing batch for idempotent request')
                return NextResponse.json({
                    success: true,
                    batchId: (existingBatch as any).id,
                    updatedCount: orderIds.length,
                    isDuplicate: true
                })
            }
        }

        // 1. Check if any orders are already being downloaded (concurrent protection)
        const { data: existingOrders } = await supabase
            .from('orders')
            .select('id, status, download_batch_id')
            .in('id', orderIds)
            .neq('status', 'pending')

        if (existingOrders && existingOrders.length > 0) {
            console.log(`[AdminBatchCreate] ${existingOrders.length} orders already processing/downloaded`)
            return NextResponse.json({
                error: `${existingOrders.length} orders are already being processed by another admin`,
                alreadyProcessed: existingOrders.length
            }, { status: 409 })
        }

        // 2. Create batch record
        // Generate filename with admin name
        const adminName = userData?.first_name?.trim() || 'Admin'
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '')
        const generatedFilename = `arhms_${adminName}_${timestamp}.xlsx`

        console.log('[BatchCreate] Generating filename:', { adminName, generatedFilename, receivedFilename: filename })

        const { data: batch, error: batchError } = await (supabase
            .from('download_batches') as any)
            .insert({
                admin_id: authUser.id,
                filename: generatedFilename, // Always use generated filename with admin name
                network: network || 'Multiple',
                order_count: orderIds.length,
                idempotency_key: idempotencyKey
            })
            .select()
            .single()

        if (batchError) throw batchError

        // 3. Link orders to batch and mark as processing
        const { error: updateError } = await (supabase
            .from('orders') as any)
            .update({
                download_batch_id: (batch as any).id,
                status: 'processing'
            })
            .in('id', orderIds)

        if (updateError) throw updateError

        // Sync with shop_orders
        const results = await Promise.allSettled(orderIds.map((id: string) => syncShopOrderStatus(id, 'processing')))
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.error(`[AdminBatchCreate] syncShopOrderStatus failed for order ${orderIds[i]}:`, r.reason)
            }
        })

        return NextResponse.json({
            success: true,
            batchId: (batch as any).id,
            filename: (batch as any).filename,
            updatedCount: orderIds.length
        })
    } catch (error: any) {
        console.error('Batch Creation Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
