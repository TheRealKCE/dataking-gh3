import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { creditShopProfit } from '@/lib/shop-service'

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

        // 2. Extract order data from metadata
        const metadata = verifyData.data?.metadata
        if (!metadata || !metadata.shop_id) {
            console.error('[Shop Verify] Missing metadata in Paystack response:', verifyData)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_error`, request.url))
        }

        // Check if order already exists (idempotency)
        const { data: existingOrder } = await db
            .from('shop_orders')
            .select('id, status')
            .eq('paystack_reference', ref)
            .single()

        // 3. Check payment status
        if (!verifyData.status || verifyData.data?.status !== 'success') {
            if (existingOrder) {
                await db
                    .from('shop_orders')
                    .update({ status: 'failed', updated_at: new Date().toISOString() })
                    .eq('id', existingOrder.id)
            }
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_failed`, request.url))
        }

        // Idempotency: if already processed, redirect to success
        if (existingOrder && existingOrder.status !== 'pending') {
            return NextResponse.redirect(new URL(`/shop/${slug}/success?ref=${ref}`, request.url))
        }

        let orderId = existingOrder?.id
        const fulfillmentMode = metadata.fulfillment_mode || 'auto'
        const initialStatus = fulfillmentMode === 'auto' ? 'processing' : 'pending'

        // 4. Create shop_orders record IF it doesn't exist
        if (!existingOrder) {
            const { data: newOrder, error: createError } = await db
                .from('shop_orders')
                .insert({
                    shop_id: metadata.shop_id,
                    package_id: metadata.package_id,
                    guest_phone: metadata.guest_phone,
                    network: metadata.network,
                    package_size: metadata.package_size,
                    selling_price: metadata.selling_price,
                    cost_price: metadata.cost_price,
                    profit: metadata.profit,
                    paystack_reference: ref,
                    status: initialStatus,
                })
                .select('id')
                .single()

            if (createError || !newOrder) {
                console.error('[Shop Verify] Failed to create shop order:', createError)
                return NextResponse.redirect(new URL(`/shop/${slug}?error=server_error`, request.url))
            }
            orderId = newOrder.id
        }

        // 4.5 Mirror to main 'orders' table for admin visibility
        try {
            const { data: shopOwner } = await db
                .from('shop_profiles')
                .select('owner_id')
                .eq('id', metadata.shop_id)
                .single()

            await db.from('orders').insert({
                user_id: shopOwner?.owner_id,
                shop_order_id: orderId, // NEW: Direct link for robust syncing
                shop_name: metadata.shop_name,
                phone_number: metadata.guest_phone,
                network: metadata.network,
                size: metadata.package_size,
                price: metadata.selling_price,
                cost_price: metadata.cost_price || 0,
                status: initialStatus,
                payment_status: 'paid',
                fulfillment_method: fulfillmentMode,
                reference_code: `SHOP-${ref.slice(-8)}`,
            })
        } catch (mirrorErr) {
            console.error('[Shop Verify] Mirroring error:', mirrorErr)
        }

        // 5. Credit profit immediately upon successful payment
        try {
            await creditShopProfit(orderId!)
        } catch (profitErr) {
            console.error('[Shop Verify] Profit credit error (non-fatal):', profitErr)
        }

        // 6. Trigger fulfillment
        try {
            if (fulfillmentMode === 'auto') {
                await triggerShopFulfillment(orderId, metadata.network, metadata.guest_phone, metadata.package_size, db)
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
            const updatedAt = new Date().toISOString()
            await db.from('shop_orders').update({
                status: 'processing',
                updated_at: updatedAt,
            }).eq('id', orderId)

            // Update mirrored main order
            const { data: sOrder } = await db.from('shop_orders').select('paystack_reference').eq('id', orderId).single()
            if (sOrder?.paystack_reference) {
                const mirrorRef = `SHOP-${sOrder.paystack_reference.slice(-8)}`
                await db.from('orders').update({
                    status: 'processing',
                    updated_at: updatedAt,
                }).eq('reference_code', mirrorRef)
            }
        } else {
            console.error(`[Shop Fulfillment] Failed for order ${orderId}:`, result.error)
        }
    } catch (err) {
        console.error(`[Shop Fulfillment] Exception for order ${orderId}:`, err)
    }
}
