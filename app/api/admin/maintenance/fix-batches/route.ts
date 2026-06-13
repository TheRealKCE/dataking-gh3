import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types
            cookies: () => cookieStore
        })
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = createServerClient()

        // 1. Find all batches labeled "Multiple"
        const { data: multipleBatches, error: batchError } = await supabase
            .from('download_batches')
            .select('id, filename, network')
            .eq('network', 'Multiple')

        if (batchError) throw batchError
        if (!multipleBatches || multipleBatches.length === 0) {
            return NextResponse.json({ message: 'No "Multiple" batches found to clean up.' })
        }

        const updates = []
        const summary = {
            totalChecked: multipleBatches.length,
            updated: 0,
            remainedMultiple: 0,
            errors: 0,
            details: [] as string[]
        }

        // 2. Process each batch
        for (const batch of multipleBatches as any[]) {
            try {
                // Find all orders in this batch
                const { data: orders, error: ordersError } = await supabase
                    .from('orders')
                    .select('network')
                    .eq('download_batch_id', batch.id)

                if (ordersError) throw ordersError

                if (!orders || (orders as any[]).length === 0) {
                    summary.remainedMultiple++
                    continue
                }

                // Identify unique networks in this batch
                const uniqueNetworks = Array.from(new Set(
                    (orders as any[])
                        .map(o => o.network?.toString().trim())
                        .filter(Boolean)
                ))

                if (uniqueNetworks.length === 1) {
                    const actualNetwork = uniqueNetworks[0]

                    // Update batch label
                    const { error: updateError } = await (supabase
                        .from('download_batches') as any)
                        .update({ network: actualNetwork })
                        .eq('id', batch.id)

                    if (updateError) throw updateError

                    summary.updated++
                    summary.details.push(`Updated batch ${batch.id} (${batch.filename}) to ${actualNetwork}`)
                } else {
                    summary.remainedMultiple++
                    summary.details.push(`Batch ${batch.id} contains ${uniqueNetworks.length} networks: [${uniqueNetworks.join(', ')}]. Kept as Multiple.`)
                }
            } catch (err: any) {
                console.error(`Error processing batch ${batch.id}:`, err)
                summary.errors++
            }
        }

        return NextResponse.json({
            success: true,
            summary
        })
    } catch (error: any) {
        console.error('Maintenance API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
