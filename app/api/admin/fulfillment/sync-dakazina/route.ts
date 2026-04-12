import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkOrderStatus } from '@/lib/fulfillment-service'
import { validateAdminAccess } from '@/lib/auth-utils'
import { syncShopOrderStatus } from '@/lib/shop-service'

export async function POST(request: NextRequest) {
    const authResult = await validateAdminAccess(true, request)
    if (authResult.error) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = createServerClient()
    let totalChecked = 0
    let totalUpdated = 0
    let totalFailed = 0
    const errors: string[] = []

    // ── Part A: shop_orders ───────────────────────────────────────────────────
    try {
        const { data: shopOrders, error: shopError } = await (supabase
            .from('shop_orders') as any)
            .select('id, dakazina_reference, status')
            .eq('fulfilled_by', 'datakazina')
            .in('status', ['pending', 'processing'])
            .not('dakazina_reference', 'is', null)
            .limit(100)

        if (shopError) {
            errors.push(`shop_orders query failed: ${shopError.message}`)
        } else {
            for (const order of shopOrders || []) {
                totalChecked++
                try {
                    const statusResult = await checkOrderStatus(order.dakazina_reference)

                    if (!statusResult.success) continue

                    const newStatus = statusResult.status
                    
                    // We only care about progressing the order to completed
                    if (newStatus !== 'completed') continue
                    if (order.status === 'completed') continue // Sanity check

                    const { error: updateError } = await (supabase
                        .from('shop_orders') as any)
                        .update({
                            status: 'completed',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', order.id)

                    if (updateError) {
                        console.error(`[SyncDakazina] shop_orders DB update failed for ${order.id}:`, updateError.message)
                        errors.push(`DB update failed for ${order.id}: ${updateError.message}`)
                        totalFailed++
                    } else {
                        totalUpdated++
                    }
                } catch (orderErr: any) {
                    errors.push(`shop_orders exception for ${order.id}: ${orderErr.message}`)
                    totalFailed++
                }
            }
        }
    } catch (partAErr: any) {
        errors.push(`Part A (shop_orders) failed: ${partAErr.message}`)
    }

    // ── Part B: orders ────────────────────────────────────────────────────────
    try {
        const { data: mainOrders, error: mainError } = await (supabase
            .from('orders') as any)
            .select('id, dakazina_reference, status')
            .eq('fulfillment_method', 'datakazina')
            .in('status', ['pending', 'processing'])
            .not('dakazina_reference', 'is', null)
            .limit(100)

        if (mainError) {
            errors.push(`orders query failed: ${mainError.message}`)
        } else {
            for (const order of mainOrders || []) {
                totalChecked++
                try {
                    const statusResult = await checkOrderStatus(order.dakazina_reference)

                    if (!statusResult.success) continue

                    const newStatus = statusResult.status
                    
                    // We only care about progressing to completed
                    if (newStatus !== 'completed') continue
                    if (order.status === 'completed') continue // Sanity check

                    const { error: updateError } = await (supabase
                        .from('orders') as any)
                        .update({
                            status: 'completed',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', order.id)

                    if (updateError) {
                        console.error(`[SyncDakazina] orders DB update failed for ${order.id}:`, updateError.message)
                        errors.push(`DB update failed for ${order.id}: ${updateError.message}`)
                        totalFailed++
                    } else {
                        await syncShopOrderStatus(order.id, 'completed').catch(err => 
                            console.error(`[SyncDakazina] Failed to sync shop order for ${order.id}:`, err)
                        )
                        totalUpdated++
                    }
                } catch (orderErr: any) {
                    errors.push(`orders exception for ${order.id}: ${orderErr.message}`)
                    totalFailed++
                }
            }
        }
    } catch (partBErr: any) {
        errors.push(`Part B (orders) failed: ${partBErr.message}`)
    }

    return NextResponse.json({
        checked: totalChecked,
        updated: totalUpdated,
        failed: totalFailed,
        errors,
    })
}
