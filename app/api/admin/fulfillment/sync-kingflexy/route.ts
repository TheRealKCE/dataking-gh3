import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createServerClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { checkOrderStatus } from '@/lib/kingflexy-service'

// Rules (same as cron):
//   KingFlexy → completed      : update order to completed
//   KingFlexy → failed/refund  : update order to failed (admin does manual refund)
//   KingFlexy → processing     : do nothing
//   Order already completed or pending : skip

export async function POST() {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: userData } = await supabase.from('users').select('role').eq('id', authUser.id).single()
        if (userData?.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

        const db = createServerClient() as any
        let checked = 0
        let updated = 0
        let failed = 0
        const errors: string[] = []

        // ── Part A: shop_orders ───────────────────────────────────────────────
        const { data: shopOrders, error: shopError } = await db
            .from('shop_orders')
            .select('id, kingflexy_reference, status')
            .eq('fulfilled_by', 'kingflexy')
            .eq('status', 'processing')
            .not('kingflexy_reference', 'is', null)
            .limit(50)

        if (shopError) {
            errors.push(`shop_orders query failed: ${shopError.message}`)
        } else {
            for (const order of shopOrders || []) {
                if (order.status === 'completed' || order.status === 'pending') continue

                checked++
                try {
                    const statusResult = await checkOrderStatus(order.kingflexy_reference)
                    if (!statusResult.success) continue

                    const newStatus = statusResult.status

                    if (newStatus === 'completed') {
                        const { error: updateError } = await db
                            .from('shop_orders')
                            .update({ status: 'completed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`shop_orders update failed for ${order.id}: ${updateError.message}`)
                            failed++
                        } else {
                            console.log(`[KingFlexySync] shop_orders ${order.id}: processing → completed`)
                            updated++
                        }
                    } else if (newStatus === 'failed') {
                        const { error: updateError } = await db
                            .from('shop_orders')
                            .update({ status: 'failed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`shop_orders update failed for ${order.id}: ${updateError.message}`)
                            failed++
                        } else {
                            console.log(`[KingFlexySync] shop_orders ${order.id}: processing → failed (manual refund required)`)
                            updated++
                        }
                    }
                } catch (err: any) {
                    errors.push(`shop_orders exception for ${order.id}: ${err.message}`)
                    failed++
                }
            }
        }

        // ── Part B: orders ────────────────────────────────────────────────────
        const { data: mainOrders, error: mainError } = await db
            .from('orders')
            .select('id, kingflexy_reference, status')
            .eq('fulfillment_method', 'kingflexy')
            .eq('status', 'processing')
            .not('kingflexy_reference', 'is', null)
            .limit(50)

        if (mainError) {
            errors.push(`orders query failed: ${mainError.message}`)
        } else {
            for (const order of mainOrders || []) {
                if (order.status === 'completed' || order.status === 'pending') continue

                checked++
                try {
                    const statusResult = await checkOrderStatus(order.kingflexy_reference)
                    if (!statusResult.success) continue

                    const newStatus = statusResult.status

                    if (newStatus === 'completed') {
                        const { error: updateError } = await db
                            .from('orders')
                            .update({ status: 'completed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`orders update failed for ${order.id}: ${updateError.message}`)
                            failed++
                        } else {
                            console.log(`[KingFlexySync] orders ${order.id}: processing → completed`)
                            updated++
                        }
                    } else if (newStatus === 'failed') {
                        const { error: updateError } = await db
                            .from('orders')
                            .update({ status: 'failed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`orders update failed for ${order.id}: ${updateError.message}`)
                            failed++
                        } else {
                            console.log(`[KingFlexySync] orders ${order.id}: processing → failed (manual refund required)`)
                            updated++
                        }
                    }
                } catch (err: any) {
                    errors.push(`orders exception for ${order.id}: ${err.message}`)
                    failed++
                }
            }
        }

        return NextResponse.json({ success: true, checked, updated, failed, errors })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
