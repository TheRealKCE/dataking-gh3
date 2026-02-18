import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { shopSlug, packageId, guestPhone } = body

        if (!shopSlug || !packageId || !guestPhone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Validate Ghana phone format
        const cleanPhone = guestPhone.replace(/\s+/g, '')
        const ghanaPhoneRegex = /^(0\d{9}|233\d{9})$/
        if (!ghanaPhoneRegex.test(cleanPhone)) {
            return NextResponse.json({ error: 'Invalid phone number. Use format: 0XXXXXXXXX or 233XXXXXXXXX' }, { status: 400 })
        }

        const supabase = createServerClient()
        const db = supabase as any

        // 1. Fetch shop (must be approved and active)
        const { data: shop, error: shopError } = await db
            .from('shop_profiles')
            .select('id, shop_name, shop_slug, owner_id, approval_status, is_active, fulfillment_mode, paystack_fee_percent')
            .eq('shop_slug', shopSlug)
            .single()

        if (shopError || !shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }
        if (shop.approval_status !== 'approved' || !shop.is_active) {
            return NextResponse.json({ error: 'This shop is not currently active' }, { status: 403 })
        }

        // 2. Fetch package (must be available)
        const { data: pkg, error: pkgError } = await db
            .from('data_packages')
            .select('id, network, size, cost_price, is_available')
            .eq('id', packageId)
            .eq('is_available', true)
            .single()

        if (pkgError || !pkg) {
            return NextResponse.json({ error: 'Package not found or unavailable' }, { status: 404 })
        }

        // 3. Fetch shop's custom selling price (server-side — never trust frontend price)
        const { data: shopPrice, error: priceError } = await db
            .from('shop_pricing')
            .select('selling_price')
            .eq('shop_id', shop.id)
            .eq('package_id', packageId)
            .single()

        if (priceError || !shopPrice) {
            return NextResponse.json({ error: 'This package is not available in this shop' }, { status: 404 })
        }

        const sellingPrice = parseFloat(shopPrice.selling_price)
        const costPrice = parseFloat(pkg.cost_price) || 0
        const profit = sellingPrice - costPrice

        if (profit <= 0) {
            return NextResponse.json({ error: 'Invalid shop pricing configuration' }, { status: 400 })
        }

        // 4. Get global settings for Paystack fee
        const { data: settingsRows } = await db
            .from('shop_global_settings')
            .select('key, value')
            .in('key', ['shop_paystack_fee_percent', 'shop_feature_enabled'])

        const settings: Record<string, any> = {}
        for (const row of (settingsRows || [])) {
            settings[row.key] = row.value
        }

        if (settings.shop_feature_enabled === false || settings.shop_feature_enabled === 'false') {
            return NextResponse.json({ error: 'Shop feature is currently disabled' }, { status: 503 })
        }

        // Use per-shop fee override or global default
        const paystackFeePercent = shop.paystack_fee_percent ?? parseFloat(settings.shop_paystack_fee_percent) ?? 1.95
        const paystackFee = Math.round(sellingPrice * (paystackFeePercent / 100) * 100) / 100
        const totalAmount = Math.round((sellingPrice + paystackFee) * 100) // Paystack uses kobo/pesewas

        // 5. Create shop_orders record (pending)
        const paystackRef = `SHOP-${shop.id.slice(0, 8)}-${Date.now()}`
        const { data: order, error: orderError } = await db
            .from('shop_orders')
            .insert({
                shop_id: shop.id,
                package_id: packageId,
                guest_phone: cleanPhone,
                network: pkg.network,
                package_size: pkg.size,
                selling_price: sellingPrice,
                cost_price: costPrice,
                profit: profit,
                paystack_reference: paystackRef,
                status: 'pending',
            })
            .select('id')
            .single()

        if (orderError || !order) {
            console.error('[Shop Initialize] Order creation error:', orderError)
            return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
        }

        // 6. Initialize Paystack — use platform email, guest stays anonymous
        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
        if (!PAYSTACK_SECRET_KEY) {
            return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 })
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kingflexygh.com'
        const callbackUrl = `${appUrl}/api/shop/verify?ref=${paystackRef}&slug=${shopSlug}`

        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'shop@kingflexydata.com',
                amount: totalAmount,
                reference: paystackRef,
                callback_url: callbackUrl,
                metadata: {
                    order_id: order.id,
                    shop_id: shop.id,
                    shop_slug: shopSlug,
                    guest_phone: cleanPhone,
                    package_id: packageId,
                    custom_fields: [
                        { display_name: 'Shop', variable_name: 'shop', value: shop.shop_name },
                        { display_name: 'Phone', variable_name: 'phone', value: cleanPhone },
                        { display_name: 'Package', variable_name: 'package', value: `${pkg.network} ${pkg.size}` },
                    ],
                },
            }),
        })

        const paystackData = await paystackRes.json()

        if (!paystackData.status || !paystackData.data?.authorization_url) {
            console.error('[Shop Initialize] Paystack error:', paystackData)
            // Cleanup the pending order
            await db.from('shop_orders').delete().eq('id', order.id)
            return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            reference: paystackRef,
        })

    } catch (error) {
        console.error('[Shop Initialize] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
