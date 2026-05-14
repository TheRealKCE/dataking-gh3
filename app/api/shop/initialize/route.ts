import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Redis } from '@upstash/redis'
import { initiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'

// Redis client for distributed idempotency across all serverless instances.
// In-memory Maps were removed — they reset on every Vercel cold start.
const redis = Redis.fromEnv()

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { shopSlug, packageId, guestPhone, guestEmail, orderType, network, amount, useExactAmount } = body

        if (!shopSlug || !guestPhone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }
        // Note: rate limiting for this route is enforced by the Upstash middleware limiter (shopInitialize: 10/min by IP).

        if (orderType === 'airtime' && (!network || !amount)) {
            return NextResponse.json({ error: 'Missing airtime fields' }, { status: 400 })
        } else if (orderType !== 'airtime' && !packageId) {
            return NextResponse.json({ error: 'Missing package identifier' }, { status: 400 })
        }

        let validatedGuestEmail: string | null = null
        if (guestEmail && typeof guestEmail === 'string' && guestEmail.trim()) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
            if (emailRegex.test(guestEmail.trim()) && guestEmail.trim().length <= 254) {
                validatedGuestEmail = guestEmail.trim().toLowerCase()
            }
        }

        if (typeof shopSlug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(shopSlug)) {
            return NextResponse.json({ error: 'Invalid shop identifier' }, { status: 400 })
        }

        if (orderType !== 'airtime' && (typeof packageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packageId))) {
            return NextResponse.json({ error: 'Invalid package identifier' }, { status: 400 })
        }

        if (typeof guestPhone !== 'string') {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
        }
        const cleanPhone = guestPhone.replace(/\s+/g, '')
        if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) {
            return NextResponse.json({ error: 'Invalid phone number. Use format: 0XXXXXXXXX or 233XXXXXXXXX' }, { status: 400 })
        }

        const { createServerClient } = await import('@/lib/supabase')
        const db = createServerClient() as any

        const { data: shop, error: shopError } = await db
            .from('shop_profiles')
            .select(`
                id, shop_name, shop_slug, owner_id, approval_status, is_active, 
                fulfillment_mode, paystack_fee_percent, owner_phone, whatsapp_number,
                airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at,
                owner:users!shop_profiles_owner_id_fkey(role, email)
            `)
            .eq('shop_slug', shopSlug)
            .single()

        if (shopError || !shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

        const ownerRole = shop.owner?.role || 'customer'
        if (shop.approval_status !== 'approved' || !shop.is_active || !['customer', 'agent', 'admin', 'sub-admin'].includes(shop.owner?.role)) {
            return NextResponse.json({
                error: 'This shop is not currently active',
                contact: { phone: shop.owner_phone, whatsapp: shop.whatsapp_number, email: shop.owner?.email }
            }, { status: 403 })
        }

        const { data: settingsRows } = await db
            .from('admin_settings')
            .select('key, value')
            .in('key', [
                'shop_feature_enabled', 'storefront_airtime_enabled',
                'airtime_enabled_mtn', 'airtime_enabled_telecel', 'airtime_enabled_at',
                'airtime_min_amount', 'airtime_max_amount',
                'airtime_fee_mtn_customer', 'airtime_fee_mtn_agent',
                'airtime_fee_telecel_customer', 'airtime_fee_telecel_agent',
                'airtime_fee_at_customer', 'airtime_fee_at_agent'
            ])

        const settings: Record<string, string> = {}
        for (const row of (settingsRows || [])) settings[row.key] = row.value

        // Fetch role-specific Paystack fee from the correct table (shop_global_settings)
        const { data: paystackFeeRows } = await db
            .from('shop_global_settings')
            .select('key, value')
            .in('key', [
                `shop_paystack_fee_percent_${ownerRole}`,
                'shop_paystack_fee_percent',
            ])
        const paystackFeeMap: Record<string, string> = {}
        for (const row of (paystackFeeRows || [])) paystackFeeMap[row.key] = row.value

        if (settings.shop_feature_enabled === 'false') {
            return NextResponse.json({ error: 'Shop feature is currently disabled' }, { status: 503 })
        }

        let totalAmount = 0
        let sellingPrice = 0
        let costPrice = 0
        let profit = 0
        let metadataPayload: any = {}
        let pkgNetwork = ''
        let pkgSize = ''

        if (orderType === 'airtime') {
            if (settings.storefront_airtime_enabled === 'false') {
                return NextResponse.json({ error: 'Airtime purchase is disabled' }, { status: 503 })
            }
            if (settings[`airtime_enabled_${network.toLowerCase()}`] === 'false') {
                return NextResponse.json({ error: `${network} airtime is disabled` }, { status: 503 })
            }

            const numAmount = parseFloat(amount)
            const minAmount = parseFloat(settings.airtime_min_amount || '1')
            const maxAmount = parseFloat(settings.airtime_max_amount || '500')
            
            if (isNaN(numAmount) || numAmount < minAmount || numAmount > maxAmount) {
                return NextResponse.json({ error: 'Invalid airtime amount' }, { status: 400 })
            }

            const shopFeeKey = `airtime_fee_${network.toLowerCase()}`
            const shopFee = parseFloat(shop[shopFeeKey] || 0)
            const adminFee = parseFloat(settings[`airtime_fee_${network.toLowerCase()}_${ownerRole}`] || '0')
            
            if (shopFee + adminFee > 10) {
                return NextResponse.json({ error: 'Airtime is temporarily unavailable (Fee cap exceeded). Please contact the shop owner.' }, { status: 503 })
            }
            
            const totalFeeMultiplier = (shopFee + adminFee) / 100
            const feeAmount = numAmount * totalFeeMultiplier
            
            let actualAirtimeAmount = numAmount
            let actualFeeAmount = feeAmount
            
            if (useExactAmount) {
                totalAmount = Math.round((numAmount + feeAmount) * 100) // pay amount + fee
            } else {
                totalAmount = Math.round(numAmount * 100) // pay exactly amount
                actualAirtimeAmount = Math.max(0, numAmount - feeAmount)
            }
            
            if (actualAirtimeAmount < minAmount) {
                return NextResponse.json({ error: `The combined fees are too high for this amount. The minimum airtime deliverable is GHS ${minAmount}.` }, { status: 400 })
            }
            
            profit = actualAirtimeAmount > 0 ? actualAirtimeAmount * (shopFee / 100) : 0
            sellingPrice = actualAirtimeAmount
            costPrice = actualAirtimeAmount
            pkgNetwork = network
            pkgSize = `GHS ${actualAirtimeAmount.toFixed(2)} Airtime`

            metadataPayload = {
                order_type: 'airtime',
                network,
                package_size: pkgSize,
                airtime_amount: actualAirtimeAmount,
                selling_price: actualAirtimeAmount,
                cost_price: actualAirtimeAmount,
                profit: profit,
                fee_amount: feeAmount,
                use_exact_amount: !!useExactAmount,
                original_amount: numAmount
            }
        } else {
            const { data: pkg } = await db.from('data_packages').select('*').eq('id', packageId).eq('is_available', true).single()
            if (!pkg) return NextResponse.json({ error: 'Package not found or unavailable' }, { status: 404 })

            const { data: shopPrice } = await db.from('shop_pricing').select('selling_price').eq('shop_id', shop.id).eq('package_id', packageId).single()
            if (!shopPrice) return NextResponse.json({ error: 'Package not available in this shop' }, { status: 404 })

            sellingPrice = parseFloat(shopPrice.selling_price)
            const isAgentOwner = shop.owner?.role === 'agent' && parseFloat(pkg.agent_price) > 0
            costPrice = isAgentOwner ? parseFloat(pkg.agent_price) : (parseFloat(pkg.price) || 0)
            profit = sellingPrice - costPrice

            if (sellingPrice <= 0 || profit <= 0) {
                return NextResponse.json({ error: 'Invalid pricing configuration' }, { status: 400 })
            }

            // --- Role-Aware Paystack Fee Resolution ---
            // Priority: per-shop override → role-specific global → legacy global → last-resort default
            let paystackFeePercent = 1.95 // last-resort only
            if (shop.paystack_fee_percent !== null && shop.paystack_fee_percent !== undefined) {
                paystackFeePercent = parseFloat(String(shop.paystack_fee_percent))
            } else if (paystackFeeMap[`shop_paystack_fee_percent_${ownerRole}`] != null) {
                paystackFeePercent = parseFloat(String(paystackFeeMap[`shop_paystack_fee_percent_${ownerRole}`]))
            } else if (paystackFeeMap['shop_paystack_fee_percent'] != null) {
                paystackFeePercent = parseFloat(String(paystackFeeMap['shop_paystack_fee_percent']))
            }
            const paystackFee = Math.round(sellingPrice * (paystackFeePercent / 100) * 100) / 100
            totalAmount = Math.round((sellingPrice + paystackFee) * 100)
            pkgNetwork = pkg.network
            pkgSize = pkg.size

            metadataPayload = {
                order_type: 'data',
                package_id: packageId,
                network: pkg.network,
                package_size: pkg.size,
                selling_price: sellingPrice,
                cost_price: costPrice,
                profit: profit,
                paystack_fee: paystackFee // Keeping this key name for backward compatibility with downstream processing
            }
        }

        // Auto-detect payment network if not explicitly provided or if it's not a main network (e.g. AT-iShare)
        let paymentNetwork = network
        if (!paymentNetwork || !['MTN', 'Telecel', 'AT'].includes(paymentNetwork)) {
            const prefix = cleanPhone.substring(0, 3)
            if (['024', '054', '055', '059', '025', '053', '098'].includes(prefix)) paymentNetwork = 'MTN'
            else if (['020', '050'].includes(prefix)) paymentNetwork = 'Telecel'
            else if (['026', '027', '056', '028', '058', '057'].includes(prefix)) paymentNetwork = 'AT'
            else paymentNetwork = 'MTN' // Fallback
        }

        const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[paymentNetwork]
        if (!channelId) {
            return NextResponse.json({ error: 'Unsupported payment network' }, { status: 400 })
        }

        const moolreRef = `SHOP-${shop.id.slice(0, 8)}-${Date.now()}`

        // Complete Metadata for Webhook processing (equivalent to what was sent to Paystack)
        const fullMetadata = {
            shop_id: shop.id,
            shop_name: shop.shop_name,
            shop_slug: shopSlug,
            guest_phone: cleanPhone,
            guest_email: validatedGuestEmail,
            fulfillment_mode: shop.fulfillment_mode,
            ...metadataPayload,
        }

        const idemKey = `shop:idem:${shop.id}-${cleanPhone}-${totalAmount}`
        const cachedIdem = await redis.get<{ ref: string }>(idemKey)
        if (cachedIdem) {
            return NextResponse.json({ success: true, reference: cachedIdem.ref, message: 'Payment prompt sent to your phone.' })
        }

        // Initialize Moolre Payment
        const moolreResponse = await initiatePayment({
            amount: totalAmount / 100, // Convert pesewas to GHS for Moolre
            payerPhone: cleanPhone,
            channel: channelId,
            externalRef: moolreRef,
        })

        if (!moolreResponse.success) {
            return NextResponse.json({ error: moolreResponse.error || 'Payment initialization failed' }, { status: 500 })
        }

        // Save metadata to Redis for Webhook
        await redis.set(`shop:meta:${moolreRef}`, JSON.stringify(fullMetadata), { ex: 86400 }) // Keep for 24 hours

        // Cache the Idempotency Key for 60 seconds to prevent duplicate transactions on retries.
        await redis.set(idemKey, { ref: moolreRef }, { ex: 60 })

        return NextResponse.json({ success: true, reference: moolreRef, message: 'Payment prompt sent to your phone. Please approve to complete your order.' })
    } catch (error) {
        console.error('[Shop Initialize] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
