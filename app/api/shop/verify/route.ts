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

        // ========================================================
        // === SECURITY: STRICT AMOUNT VERIFICATION (Zero-Trust) ===
        // ========================================================
        // NEVER trust metadata for pricing. Re-query the database
        // to get the REAL selling price and compare against what
        // Paystack actually charged.

        const paystackAmountPesewas = verifyData.data?.amount // Paystack returns amount in pesewas
        if (!paystackAmountPesewas || paystackAmountPesewas <= 0) {
            console.error(`[Shop Verify] FRAUD ALERT: Invalid Paystack amount. Ref: ${ref}, Amount: ${paystackAmountPesewas}`)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_error`, request.url))
        }

        // Re-query the REAL selling price from the database (single source of truth)
        const { data: shopPrice } = await db
            .from('shop_pricing')
            .select('selling_price')
            .eq('shop_id', metadata.shop_id)
            .eq('package_id', metadata.package_id)
            .single()

        if (!shopPrice) {
            console.error(`[Shop Verify] SECURITY: Package ${metadata.package_id} not found in shop ${metadata.shop_id} pricing. Ref: ${ref}`)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_error`, request.url))
        }

        const dbSellingPrice = parseFloat(shopPrice.selling_price)

        // Fetch Paystack fee settings to calculate the expected total
        const { data: shopProfile } = await db
            .from('shop_profiles')
            .select('owner_id, paystack_fee_percent, fulfillment_mode')
            .eq('id', metadata.shop_id)
            .single()

        const { data: settingsRows } = await db
            .from('shop_global_settings')
            .select('key, value')
            .in('key', ['shop_paystack_fee_percent'])

        const globalFeePercent = settingsRows?.find((r: any) => r.key === 'shop_paystack_fee_percent')?.value
        const paystackFeePercent = shopProfile?.paystack_fee_percent ?? parseFloat(globalFeePercent) ?? 1.95
        const paystackFee = Math.round(dbSellingPrice * (paystackFeePercent / 100) * 100) / 100
        const expectedTotalPesewas = Math.round((dbSellingPrice + paystackFee) * 100)

        // Allow a tiny tolerance (1 pesewa) for rounding differences
        const amountDifference = Math.abs(paystackAmountPesewas - expectedTotalPesewas)
        if (amountDifference > 1) {
            console.error(
                `[Shop Verify] 🚨 FRAUD DETECTED: Amount mismatch! ` +
                `Ref: ${ref}, Paid: ${paystackAmountPesewas} pesewas, Expected: ${expectedTotalPesewas} pesewas, ` +
                `DB Price: ${dbSellingPrice}, Fee%: ${paystackFeePercent}%, Diff: ${amountDifference} pesewas`
            )
            // Do NOT process this order — redirect with error
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_mismatch`, request.url))
        }

        // === SECURITY: Use DB-verified prices, NOT metadata ===
        const { data: pkg } = await db
            .from('data_packages')
            .select('price')
            .eq('id', metadata.package_id)
            .single()

        const verifiedCostPrice = parseFloat(pkg?.price) || 0
        const verifiedProfit = dbSellingPrice - verifiedCostPrice

        // ========================================================

        let orderId = existingOrder?.id
        const fulfillmentMode = shopProfile?.fulfillment_mode || metadata.fulfillment_mode || 'auto'
        const initialStatus = fulfillmentMode === 'auto' ? 'processing' : 'pending'

        // 4. Create shop_orders record IF it doesn't exist (with DB-verified prices)
        if (!existingOrder) {
            const { data: newOrder, error: createError } = await db
                .from('shop_orders')
                .insert({
                    shop_id: metadata.shop_id,
                    package_id: metadata.package_id,
                    guest_phone: metadata.guest_phone,
                    network: metadata.network,
                    package_size: metadata.package_size,
                    selling_price: dbSellingPrice,        // FROM DATABASE, not metadata
                    cost_price: verifiedCostPrice,        // FROM DATABASE, not metadata
                    profit: verifiedProfit,                // CALCULATED from DB values
                    paystack_reference: ref,
                    status: initialStatus,
                })
                .select('id')
                .single()

            if (createError) {
                // Race condition guard: if duplicate insert, try to fetch the existing one
                if (createError.code === '23505') { // unique_violation
                    console.log(`[Shop Verify] Duplicate insert caught for ref: ${ref}. Fetching existing.`)
                    const { data: raceOrder } = await db
                        .from('shop_orders')
                        .select('id, status')
                        .eq('paystack_reference', ref)
                        .single()
                    if (raceOrder) {
                        return NextResponse.redirect(new URL(`/shop/${slug}/success?ref=${ref}`, request.url))
                    }
                }
                console.error('[Shop Verify] Failed to create shop order:', createError)
                return NextResponse.redirect(new URL(`/shop/${slug}?error=server_error`, request.url))
            }
            orderId = newOrder?.id
        }

        // NOTE: Shop orders live only in shop_orders, NOT mirrored to orders.
        // Mirroring was removed to prevent guest shop orders from appearing
        // in the shop owner's personal 'My Order History' page.

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

            // No mirror record to update — shop orders are self-contained in shop_orders.
        } else {
            console.error(`[Shop Fulfillment] Failed for order ${orderId}:`, result.error)
        }
    } catch (err) {
        console.error(`[Shop Fulfillment] Exception for order ${orderId}:`, err)
    }
}
