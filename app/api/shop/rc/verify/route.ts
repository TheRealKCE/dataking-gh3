import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { Redis } from '@upstash/redis'
import { checkPaymentStatus } from '@/lib/moolre-payment-service'
import { sendPushToAdmins } from '@/lib/web-push'

const redis = Redis.fromEnv()

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref')
    const slug = searchParams.get('slug')

    if (!ref || !slug) {
        return NextResponse.json({ success: false, error: 'ref and slug are required' }, { status: 400 })
    }

    if (!ref.startsWith('RC-SHOP-') || ref.length > 60) {
        return NextResponse.json({ success: false, error: 'invalid_ref' }, { status: 400 })
    }

    try {
        // 1. Check Moolre payment status
        const moolreResponse = await checkPaymentStatus(ref)

        if (!moolreResponse.success || moolreResponse.txstatus === null) {
            return NextResponse.json({ success: true, status: 'pending' })
        }

        // Pending / processing
        if (moolreResponse.txstatus === 0 || moolreResponse.txstatus === 3) {
            return NextResponse.json({ success: true, status: 'pending' })
        }

        // Failed / cancelled
        if (moolreResponse.txstatus === 2) {
            // Release reserved vouchers by updating the pending order to failed
            await _failOrder(ref)
            return NextResponse.json({ success: false, status: 'failed', message: 'Payment was not completed.' })
        }

        // 2. Payment succeeded — fetch metadata from Redis
        const metaStr = await redis.get<string>(`shop:rc:meta:${ref}`)
        if (!metaStr) {
            console.error('[shop/rc/verify] Metadata missing from Redis for ref:', ref)
            return NextResponse.json({ success: false, status: 'error', error: 'Order metadata not found' }, { status: 500 })
        }

        let meta: any
        try {
            meta = typeof metaStr === 'string' ? JSON.parse(metaStr) : metaStr
        } catch {
            meta = metaStr
        }

        const db = createServerClient() as any

        // 3. Idempotency — check if already fulfilled
        const { data: existingOrder } = await db
            .from('results_checker_orders')
            .select('id, status, payment_status, inventory_ids')
            .eq('id', meta.order_id)
            .maybeSingle()

        if (existingOrder?.payment_status === 'completed') {
            // Already processed — return vouchers from DB
            const vouchers = await _fetchVouchers(db, existingOrder.inventory_ids || [])
            return NextResponse.json({ success: true, status: 'completed', vouchers })
        }

        // 4. Finalize: mark inventory as sold
        const { data: soldCount, error: finalizeErr } = await db.rpc('finalize_results_checker_sale', {
            p_order_id: meta.order_id,
            p_user_id: null,
        })

        if (finalizeErr) {
            console.error('[shop/rc/verify] finalize_results_checker_sale failed:', finalizeErr)
            return NextResponse.json({ success: false, status: 'error', error: 'Failed to finalize vouchers' }, { status: 500 })
        }

        // 5. Fetch the sold inventory IDs for this order
        const { data: soldInventory } = await db
            .from('results_checker_inventory')
            .select('id, pin, serial_number')
            .eq('status', 'sold')
            .eq('sold_to_user_id', null) // guest purchase
            // Match by reserved_by_order which was the temp order ID
            // Actually finalize_results_checker_sale uses reserved_by_order = p_order_id
            // We stored temp order ID as the reservation, so we need to use it here
            // Instead, fetch by the order record's inventory_ids once updated below

        // Fetch by looking up reserved inventory that was just finalized
        const { data: newlyFinalizedInventory } = await db
            .from('results_checker_inventory')
            .select('id, pin, serial_number')
            .eq('type_id', meta.rc_type_id)
            .eq('status', 'sold')
            .is('reserved_by_order', null)
            .order('sold_at', { ascending: false })
            .limit(meta.quantity)

        const inventoryIds = (newlyFinalizedInventory || []).map((i: any) => i.id)

        // 6. Update order to completed
        await db
            .from('results_checker_orders')
            .update({
                status: 'completed',
                payment_status: 'completed',
                inventory_ids: inventoryIds,
                fulfilled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', meta.order_id)

        // 7. Credit shop wallet profit
        const shopProfit = meta.shop_markup || 0
        if (shopProfit > 0) {
            try {
                // Upsert shop wallet
                const { data: wallet } = await db
                    .from('shop_wallets')
                    .select('id, balance, total_earned')
                    .eq('owner_id', meta.owner_id)
                    .maybeSingle()

                if (wallet) {
                    await db
                        .from('shop_wallets')
                        .update({
                            balance: wallet.balance + shopProfit,
                            total_earned: wallet.total_earned + shopProfit,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('owner_id', meta.owner_id)

                    await db
                        .from('shop_wallet_transactions')
                        .insert({
                            shop_wallet_id: wallet.id,
                            type: 'profit',
                            amount: shopProfit,
                            net_amount: shopProfit,
                            description: `RC Voucher sale: ${meta.rc_type_name} × ${meta.quantity}`,
                            status: 'completed',
                        })
                }
            } catch (profitErr) {
                // Non-fatal — log but don't block voucher delivery
                console.error('[shop/rc/verify] Profit credit error:', profitErr)
            }
        }

        // 8. Notify admin of RC sale
        await sendPushToAdmins({
            title: 'Results Checker Sale',
            body: `${meta.quantity}x ${meta.rc_type_name || 'RC Voucher'} sold · Shop: ${slug}`,
            url: '/admin/vouchers',
        }).catch(() => {})

        // 9. Clean up Redis meta
        await redis.del(`shop:rc:meta:${ref}`)
        await redis.del(`shop:rc:orderid:${ref}`)

        const vouchers = (newlyFinalizedInventory || []).map((v: any) => ({
            pin: v.pin,
            serial_number: v.serial_number,
        }))

        return NextResponse.json({ success: true, status: 'completed', vouchers })

    } catch (error: any) {
        console.error('[shop/rc/verify]', error)
        return NextResponse.json({ success: false, status: 'error', error: 'Internal server error' }, { status: 500 })
    }
}

async function _failOrder(ref: string) {
    try {
        const db = createServerClient() as any
        await db
            .from('results_checker_orders')
            .update({ status: 'failed', payment_status: 'failed', updated_at: new Date().toISOString() })
            .eq('reference_code', ref)
    } catch (e) {
        console.error('[shop/rc/verify] _failOrder error:', e)
    }
}

async function _fetchVouchers(db: any, inventoryIds: string[]) {
    if (!inventoryIds.length) return []
    const { data } = await db
        .from('results_checker_inventory')
        .select('pin, serial_number')
        .in('id', inventoryIds)
    return (data || []).map((v: any) => ({ pin: v.pin, serial_number: v.serial_number }))
}
