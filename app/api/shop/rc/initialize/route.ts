import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { Redis } from '@upstash/redis'
import { initiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'

const redis = Redis.fromEnv()

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            shopSlug,
            rcTypeId,
            quantity,
            customerName,
            customerPhone,
            customerEmail,
            otpCode,
            reference: existingRef,
        } = body

        // ── Input validation ──────────────────────────────────────────────────────
        if (!shopSlug || !rcTypeId || !quantity || !customerPhone) {
            return NextResponse.json({ error: 'Missing required fields: shopSlug, rcTypeId, quantity, customerPhone' }, { status: 400 })
        }

        const qty = parseInt(quantity)
        if (isNaN(qty) || qty < 1 || qty > 10) {
            return NextResponse.json({ error: 'Quantity must be between 1 and 10' }, { status: 400 })
        }

        const cleanPhone = String(customerPhone).replace(/\s+/g, '')
        if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) {
            return NextResponse.json({ error: 'Invalid phone number. Use format: 0XXXXXXXXX' }, { status: 400 })
        }

        let validEmail: string | null = null
        if (customerEmail) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
            if (emailRegex.test(String(customerEmail).trim())) {
                validEmail = String(customerEmail).trim().toLowerCase()
            }
        }

        const db = createServerClient() as any

        // ── 1. Check global toggle ────────────────────────────────────────────────
        const { data: settingRow } = await db
            .from('admin_settings')
            .select('value')
            .eq('key', 'storefront_rc_enabled')
            .maybeSingle()

        if (!settingRow || settingRow.value !== 'true') {
            return NextResponse.json({ error: 'Results Checker is not available on storefronts' }, { status: 503 })
        }

        // ── 2. Fetch shop ─────────────────────────────────────────────────────────
        const { data: shop } = await db
            .from('shop_profiles')
            .select('id, shop_name, owner_id, approval_status, is_active, owner_phone, whatsapp_number, owner:users!shop_profiles_owner_id_fkey(role)')
            .eq('shop_slug', shopSlug)
            .single()

        if (!shop || shop.approval_status !== 'approved' || !shop.is_active) {
            return NextResponse.json({ error: 'Shop is not currently active' }, { status: 403 })
        }

        // ── 3. Fetch shop RC pricing row ──────────────────────────────────────────
        const { data: shopPricing } = await db
            .from('shop_rc_pricing')
            .select('selling_price')
            .eq('shop_id', shop.id)
            .eq('rc_type_id', rcTypeId)
            .maybeSingle()

        if (!shopPricing) {
            return NextResponse.json({ error: 'This voucher type is not available in this shop' }, { status: 404 })
        }

        // ── 4. Fetch RC type (cost price, name, availability) ─────────────────────
        const { data: rcType } = await db
            .from('results_checker_types')
            .select('id, name, cost_price, is_active')
            .eq('id', rcTypeId)
            .maybeSingle()

        if (!rcType || !rcType.is_active) {
            return NextResponse.json({ error: 'Voucher type is not available' }, { status: 404 })
        }

        const sellingPrice = parseFloat(shopPricing.selling_price)
        const costPrice = parseFloat(rcType.cost_price)
        const shopMarkup = (sellingPrice - costPrice) * qty
        const totalAmount = sellingPrice * qty

        // ── 5. Reserve vouchers ───────────────────────────────────────────────────
        // Use a temp order ID for reservation; will be replaced by real order below
        const tempOrderId = existingRef
            ? await redis.get<string>(`shop:rc:orderid:${existingRef}`) || crypto.randomUUID()
            : crypto.randomUUID()

        if (!existingRef) {
            // Only reserve on the first call (not OTP retry)
            const { data: reserved, error: reserveErr } = await db.rpc('assign_results_checker_vouchers', {
                p_type_id: rcTypeId,
                p_quantity: qty,
                p_order_id: tempOrderId,
            })

            if (reserveErr) {
                if (reserveErr.message?.includes('INSUFFICIENT_INVENTORY')) {
                    return NextResponse.json({ error: 'Not enough vouchers in stock. Please try a smaller quantity.' }, { status: 409 })
                }
                console.error('[shop/rc/initialize] Reserve error:', reserveErr)
                return NextResponse.json({ error: 'Failed to reserve vouchers' }, { status: 500 })
            }

            if (!reserved || reserved.length < qty) {
                return NextResponse.json({ error: 'Not enough vouchers in stock.' }, { status: 409 })
            }

            // ── 6. Create pending order ───────────────────────────────────────────
            const referenceCode = `RC-SHOP-${shop.id.slice(0, 8)}-${Date.now()}`

            const { data: order, error: orderErr } = await db
                .from('results_checker_orders')
                .insert({
                    user_id: null,
                    user_role: 'customer',
                    shop_id: shop.id,
                    shop_name: shop.shop_name,
                    shop_markup: shopMarkup,
                    customer_name: customerName || 'Guest',
                    customer_email: validEmail,
                    customer_phone: cleanPhone,
                    type_id: rcTypeId,
                    type_name: rcType.name,
                    quantity: qty,
                    unit_price: sellingPrice,
                    cost_price_at_time: costPrice,
                    fee_amount: 0,
                    total_paid: totalAmount,
                    merchant_commission: shopMarkup,
                    status: 'pending',
                    payment_status: 'pending_payment',
                    reference_code: referenceCode,
                })
                .select('id')
                .single()

            if (orderErr || !order) {
                console.error('[shop/rc/initialize] Order creation failed:', orderErr)
                return NextResponse.json({ error: 'Failed to initialize order' }, { status: 500 })
            }

            // Store mapping: moolreRef → orderId for use in verify route
            const moolreRef = `RC-SHOP-${shop.id.slice(0, 8)}-${Date.now()}`
            await redis.set(`shop:rc:orderid:${moolreRef}`, order.id, { ex: 86400 })
            await redis.set(`shop:rc:meta:${moolreRef}`, JSON.stringify({
                shop_id: shop.id,
                shop_name: shop.shop_name,
                rc_type_id: rcTypeId,
                rc_type_name: rcType.name,
                order_id: order.id,
                quantity: qty,
                unit_price: sellingPrice,
                cost_price: costPrice,
                shop_markup: shopMarkup,
                total_paid: totalAmount,
                owner_id: shop.owner_id,
            }), { ex: 86400 })

            // ── 7. Auto-detect payment network ────────────────────────────────────
            const prefix = cleanPhone.substring(0, 3)
            let paymentNetwork = 'MTN'
            if (['020', '050'].includes(prefix)) paymentNetwork = 'Telecel'
            else if (['026', '027', '056', '028', '058', '057'].includes(prefix)) paymentNetwork = 'AT'

            const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[paymentNetwork]
            if (!channelId) {
                return NextResponse.json({ error: 'Unsupported payment network' }, { status: 400 })
            }

            // ── 8. Initiate Moolre MoMo payment ──────────────────────────────────
            let moolreResponse = await initiatePayment({
                amount: totalAmount,
                payerPhone: cleanPhone,
                channel: channelId,
                externalRef: moolreRef,
                otpCode: undefined,
            })

            if (!moolreResponse.success) {
                return NextResponse.json({ error: moolreResponse.error || 'Payment initialization failed' }, { status: 500 })
            }

            if (moolreResponse.status === '200_OTP_REQ') {
                return NextResponse.json({
                    success: true,
                    otpRequired: true,
                    reference: moolreRef,
                    message: 'OTP required. Please enter the code sent to your phone.',
                })
            }

            return NextResponse.json({
                success: true,
                reference: moolreRef,
                otpRequired: false,
                message: 'Payment prompt sent to your phone. Please approve to complete your purchase.',
            })
        }

        // ── OTP retry path ────────────────────────────────────────────────────────
        if (!otpCode) {
            return NextResponse.json({ error: 'OTP code is required to complete payment' }, { status: 400 })
        }

        // Re-detect network from original phone
        const prefix = cleanPhone.substring(0, 3)
        let paymentNetwork = 'MTN'
        if (['020', '050'].includes(prefix)) paymentNetwork = 'Telecel'
        else if (['026', '027', '056', '028', '058', '057'].includes(prefix)) paymentNetwork = 'AT'

        const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[paymentNetwork]

        let moolreResponse = await initiatePayment({
            amount: totalAmount,
            payerPhone: cleanPhone,
            channel: channelId,
            externalRef: existingRef,
            otpCode,
        })

        if (moolreResponse.success && String(moolreResponse.status) === '1' && otpCode) {
            moolreResponse = await initiatePayment({
                amount: totalAmount,
                payerPhone: cleanPhone,
                channel: channelId,
                externalRef: existingRef,
            })
        }

        if (!moolreResponse.success) {
            return NextResponse.json({ error: moolreResponse.error || 'Payment failed' }, { status: 500 })
        }

        if (moolreResponse.status === '200_OTP_REQ') {
            return NextResponse.json({
                success: true,
                otpRequired: true,
                reference: existingRef,
                message: 'Invalid OTP or OTP expired. Please try again.',
            })
        }

        return NextResponse.json({
            success: true,
            reference: existingRef,
            otpRequired: false,
            message: 'Payment prompt sent to your phone. Please approve to complete your purchase.',
        })

    } catch (error: any) {
        console.error('[shop/rc/initialize]', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
