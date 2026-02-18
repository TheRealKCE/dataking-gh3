import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref')
    const slug = searchParams.get('slug')

    if (!ref || !slug) {
        return NextResponse.redirect(new URL(`/shop/${slug || ''}?error=invalid_ref`, request.url))
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kingflexygh.com'

    try {
        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
        if (!PAYSTACK_SECRET_KEY) {
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_error`, request.url))
        }

        // 1. Verify payment with Paystack
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
            headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` },
        })
        const verifyData = await verifyRes.json()

        const supabase = createServerClient()
        const db = supabase as any

        // 2. Fetch the order by reference
        const { data: order, error: orderError } = await db
            .from('shop_orders')
            .select('*, shop_profiles(id, owner_id, fulfillment_mode, shop_name)')
            .eq('paystack_reference', ref)
            .single()

        if (orderError || !order) {
            console.error('[Shop Verify] Order not found for ref:', ref)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=order_not_found`, request.url))
        }

        // Idempotency: if already processed, redirect to success
        if (order.status !== 'pending') {
            return NextResponse.redirect(new URL(`/shop/${slug}/success?ref=${ref}`, request.url))
        }

        // 3. Check payment status
        if (!verifyData.status || verifyData.data?.status !== 'success') {
            // Payment failed — mark order as failed
            await db
                .from('shop_orders')
                .update({ status: 'failed', updated_at: new Date().toISOString() })
                .eq('id', order.id)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_failed`, request.url))
        }

        // 4. Mark order as processing
        await db
            .from('shop_orders')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', order.id)

        const profit = parseFloat(order.profit) || 0
        const ownerId = order.shop_profiles?.owner_id

        // 4.5 Mirror to main 'orders' table for admin visibility
        try {
            const shopName = order.shop_profiles?.shop_name || 'Shop'
            await db.from('orders').insert({
                user_id: ownerId,
                phone_number: order.guest_phone,
                network: order.network,
                size: order.package_size,
                price: order.selling_price,
                cost_price: order.cost_price || 0,
                status: 'processing',
                payment_status: 'paid',
                fulfillment_method: 'auto',
                reference_code: `SHOP-${ref.slice(-8)}`,
            })
        } catch (mirrorErr) {
            console.error('[Shop Verify] Mirroring error:', mirrorErr)
            // Continue even if mirroring fails
        }

        // 5. Credit profit to shop wallet (atomic upsert)
        if (ownerId && profit > 0) {
            // Get or create shop wallet
            const { data: wallet } = await db
                .from('shop_wallets')
                .select('id, balance, total_earned')
                .eq('owner_id', ownerId)
                .single()

            if (wallet) {
                await db
                    .from('shop_wallets')
                    .update({
                        balance: (parseFloat(wallet.balance) || 0) + profit,
                        total_earned: (parseFloat(wallet.total_earned) || 0) + profit,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', wallet.id)

                // Log the transaction
                await db.from('shop_wallet_transactions').insert({
                    shop_wallet_id: wallet.id,
                    type: 'profit',
                    amount: profit,
                    description: `Sale: ${order.network} ${order.package_size} to ${order.guest_phone}`,
                    status: 'completed',
                })
            }
        }

        // 6. Trigger fulfillment
        try {
            const fulfillmentMode = order.shop_profiles?.fulfillment_mode || 'auto'
            if (fulfillmentMode === 'auto') {
                await triggerShopFulfillment(order.id, order.network, order.guest_phone, order.package_size, db)
            }
        } catch (fulfillErr) {
            console.error('[Shop Verify] Fulfillment error:', fulfillErr)
            // Don't fail the redirect — order is paid, fulfillment can be retried
        }

        return NextResponse.redirect(new URL(`/shop/${slug}/success?ref=${ref}`, request.url))

    } catch (error) {
        console.error('[Shop Verify] Error:', error)
        return NextResponse.redirect(new URL(`/shop/${slug}?error=server_error`, request.url))
    }
}

async function triggerShopFulfillment(
    orderId: string,
    network: string,
    phone: string,
    size: string,
    db: any
) {
    try {
        const { fulfillOrder } = await import('@/lib/fulfillment-service')

        // Check global auto-fulfillment toggle
        const { data: settingsData } = await db
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])

        const settingsMap = (settingsData || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        if (settingsMap.auto_fulfillment_enabled === 'false') {
            console.log(`[Shop Fulfillment] Auto-fulfillment globally disabled`)
            return
        }

        let fulfillmentSettings = { networks: {} as Record<string, boolean> }
        try {
            if (settingsMap.fulfillment_settings) {
                fulfillmentSettings = typeof settingsMap.fulfillment_settings === 'string'
                    ? JSON.parse(settingsMap.fulfillment_settings)
                    : settingsMap.fulfillment_settings
            }
        } catch (e) { /* ignore */ }

        const isNetworkEnabled = fulfillmentSettings.networks[network] !== false
        if (!isNetworkEnabled) {
            console.log(`[Shop Fulfillment] Auto-fulfillment disabled for ${network}`)
            return
        }

        const result = await fulfillOrder(network, phone, size, orderId)

        if (result.success) {
            await db.from('shop_orders').update({
                status: 'processing',
                updated_at: new Date().toISOString(),
            }).eq('id', orderId)
        } else {
            console.error(`[Shop Fulfillment] Failed for order ${orderId}:`, result.error)
        }
    } catch (err) {
        console.error(`[Shop Fulfillment] Exception for order ${orderId}:`, err)
    }
}
