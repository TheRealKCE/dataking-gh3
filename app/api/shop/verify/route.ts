import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { creditShopProfit } from '@/lib/shop-service'
import { sendOrderSuccessSMS } from '@/lib/sms-service'

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
        // Idempotency: if already processed, redirect to success
        if (existingOrder && existingOrder.status !== 'pending' && existingOrder.status !== 'failed') {
            return NextResponse.redirect(new URL(`/shop/${slug}/success?ref=${ref}`, request.url))
        }

        // ========================================================
        // 1. SECURITY PRE-CHECKS (Basic validation)
        // ========================================================
        const paystackAmountPesewas = verifyData.data?.amount
        if (!paystackAmountPesewas || paystackAmountPesewas <= 0) {
            console.error(`[Shop Verify] ERROR: Invalid Paystack amount. Ref: ${ref}, Amount: ${paystackAmountPesewas}`)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_error`, request.url))
        }

        // Fetch Paystack fee settings and shop profile
        const { data: shopProfile } = await db
            .from('shop_profiles')
            .select('owner_id, shop_name, paystack_fee_percent, fulfillment_mode')
            .eq('id', metadata.shop_id)
            .single()

        const { data: settingsRows } = await db
            .from('shop_global_settings')
            .select('key, value')
            .in('key', ['shop_paystack_fee_percent'])

        const globalFeePercent = settingsRows?.find((r: any) => r.key === 'shop_paystack_fee_percent')?.value
        const paystackFeePercent = shopProfile?.paystack_fee_percent ?? parseFloat(globalFeePercent) ?? 1.95

        // Fetch package to calculate cost prices
        const { data: pkg } = await db
            .from('data_packages')
            .select('price, agent_price')
            .eq('id', metadata.package_id)
            .single()

        // Fetch shop's REAL price (single source of truth)
        const { data: shopPrice } = await db
            .from('shop_pricing')
            .select('selling_price')
            .eq('shop_id', metadata.shop_id)
            .eq('package_id', metadata.package_id)
            .single()

        if (!shopPrice || !pkg) {
            console.error(`[Shop Verify] SECURITY: Pricing/Package not found for Ref: ${ref}`)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_error`, request.url))
        }

        const dbSellingPrice = parseFloat(shopPrice.selling_price)
        const paystackFee = Math.round(dbSellingPrice * (paystackFeePercent / 100) * 100) / 100
        const expectedTotalPesewas = Math.round((dbSellingPrice + paystackFee) * 100)

        // Cost price calculation
        const { data: ownerProfile } = await db
            .from('users')
            .select('role')
            .eq('id', shopProfile?.owner_id)
            .single()

        const isAgentOwner = ownerProfile?.role === 'agent' && parseFloat(pkg?.agent_price) > 0
        const verifiedCostPrice = isAgentOwner ? parseFloat(pkg?.agent_price) : (parseFloat(pkg?.price) || 0)
        const verifiedProfit = dbSellingPrice - verifiedCostPrice

        // ========================================================
        // 2. CREATE ORDER RECORDS (Before Amount Validation)
        // ========================================================
        // This ensures the order is NEVER lost, even if it fails the amount check.
        let orderId = existingOrder?.id
        const fulfillmentMode = shopProfile?.fulfillment_mode || metadata.fulfillment_mode || 'auto'

        if (!existingOrder) {
            const { data: newOrder, error: createError } = await db
                .from('shop_orders')
                .insert({
                    shop_id: metadata.shop_id,
                    package_id: metadata.package_id,
                    guest_phone: metadata.guest_phone,
                    network: metadata.network,
                    package_size: metadata.package_size,
                    selling_price: dbSellingPrice,
                    cost_price: verifiedCostPrice,
                    profit: verifiedProfit,
                    paystack_reference: ref,
                    status: 'pending', // Always start as pending
                })
                .select('id')
                .single()

            if (createError) {
                // Duplicate check
                if (createError.code === '23505') {
                    const { data: raceOrder } = await db.from('shop_orders').select('id').eq('paystack_reference', ref).single()
                    if (raceOrder) return NextResponse.redirect(new URL(`/shop/${slug}/success?ref=${ref}`, request.url))
                }
                console.error('[Shop Verify] Failed to create shop order:', createError)
                return NextResponse.json({ error: 'Failed' }, { status: 500 })
            }
            orderId = newOrder?.id

            // Mirror to main orders table
            await db.from('orders').insert({
                user_id: shopProfile?.owner_id,
                phone_number: metadata.guest_phone,
                network: metadata.network,
                size: metadata.package_size,
                price: dbSellingPrice,
                cost_price: verifiedCostPrice,
                status: 'pending',
                payment_status: 'paid',
                reference_code: `SHOP-${ref.slice(-10)}`,
                fulfillment_method: 'auto',
                shop_name: shopProfile?.shop_name || slug,
                shop_order_id: orderId
            })
        }

        // ========================================================
        // 3. SECURITY: STRICT AMOUNT VERIFICATION
        // ========================================================
        // Higher tolerance (5 pesewas) to absorb rounding differences
        const amountDifference = Math.abs(paystackAmountPesewas - expectedTotalPesewas)
        if (amountDifference > 5) {
            console.error(`[Shop Verify] 🚨 AMOUNT MISMATCH: Ref: ${ref}, Paid: ${paystackAmountPesewas}, Expected: ${expectedTotalPesewas}`)

            // Mark orders as failed but keep the record for tracing
            await db.from('shop_orders').update({ status: 'failed' }).eq('id', orderId)
            await db.from('orders').update({ status: 'failed' }).eq('shop_order_id', orderId)

            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_mismatch`, request.url))
        }

        // ========================================================
        // 4. PROCESS VALID ORDER (Profit & Fulfillment)
        // ========================================================
        const initialStatus = fulfillmentMode === 'auto' ? 'processing' : 'pending'

        // Update status from pending to initial status (e.g. processing)
        if (initialStatus !== 'pending') {
            await db.from('shop_orders').update({ status: initialStatus }).eq('id', orderId)
            await db.from('orders').update({ status: initialStatus }).eq('shop_order_id', orderId)
        }

        // 4.5 Send order confirmation SMS (Async)
        if (metadata.guest_phone) {
            sendOrderSuccessSMS(metadata.guest_phone, {
                network: metadata.network,
                size: metadata.package_size,
                price: dbSellingPrice,
                recipientNumber: metadata.guest_phone,
                currentBalance: 0
            }).catch((err: Error) => console.error('[Shop Verify] SMS error:', err))
        }

        // 5. Credit profit (Gated by successful security check)
        try {
            await creditShopProfit(orderId!)
        } catch (profitErr) {
            console.error('[Shop Verify] Profit credit error:', profitErr)
        }

        // 6. Trigger fulfillment
        try {
            if (fulfillmentMode === 'auto') {
                await triggerShopFulfillment(orderId!, metadata.network, metadata.guest_phone, metadata.package_size, db)
            }
        } catch (fulfillErr) {
            console.error('[Shop Verify] Fulfillment error:', fulfillErr)
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

            // No mirror record to update — shop orders are self-contained in shop_orders.
        } else {
            console.error(`[Shop Fulfillment] Failed for order ${orderId}:`, result.error)
        }
    } catch (err) {
        console.error(`[Shop Fulfillment] Exception for order ${orderId}:`, err)
    }
}
