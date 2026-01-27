import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({ cookies: () => cookieStore as any })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
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
        const supabase = createServerClient()

        // 0. Check for existing batch with idempotency key
        if (idempotencyKey) {
            const { data: existingBatch } = await supabase
                .from('download_batches')
                .select('id')
                .eq('idempotency_key', idempotencyKey)
                .single()

            if (existingBatch) {
                console.log(`[AdminBatchCreate] Returning existing batch for idempotency key: ${idempotencyKey}`)
                return NextResponse.json({
                    success: true,
                    batchId: (existingBatch as any).id,
                    updatedCount: orderIds.length,
                    isDuplicate: true
                })
            }
        }

        // 1. Create batch record
        const { data: batch, error: batchError } = await (supabase
            .from('download_batches') as any)
            .insert({
                filename: filename || `ghdata_orders_${new Date().toISOString()}.xlsx`,
                network: network || 'Multiple',
                order_count: orderIds.length,
                idempotency_key: idempotencyKey
            })
            .select()
            .single()

        if (batchError) throw batchError

        // 2. Link orders to batch and mark as processing
        const { error: updateError } = await (supabase
            .from('orders') as any)
            .update({
                download_batch_id: (batch as any).id,
                status: 'processing'
            })
            .in('id', orderIds)

        if (updateError) throw updateError

        return NextResponse.json({
            success: true,
            batchId: (batch as any).id,
            updatedCount: orderIds.length
        })
    } catch (error: any) {
        console.error('Batch Creation Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
