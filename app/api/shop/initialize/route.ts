import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { shopSlug, packageId, guestPhone, guestEmail } = body

        if (!shopSlug || !packageId || !guestPhone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Validate guestEmail if provided
        let validatedGuestEmail: string | null = null
        if (guestEmail && typeof guestEmail === 'string' && guestEmail.trim()) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
            if (emailRegex.test(guestEmail.trim()) && guestEmail.trim().length <= 254) {
                validatedGuestEmail = guestEmail.trim().toLowerCase()
            }
        }

        // === SECURITY: Strict input validation ===
        // Validate shopSlug format (alphanumeric, dashes, 3-60 chars)
        if (typeof shopSlug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(shopSlug)) {
            return NextResponse.json({ error: 'Invalid shop identifier' }, { status: 400 })
        }

        // Validate packageId format (UUID v4)
        if (typeof packageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packageId)) {
            return NextResponse.json({ error: 'Invalid package identifier' }, { status: 400 })
        }

        // Validate Ghana phone format
        if (typeof guestPhone !== 'string') {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
        }
        const cleanPhone = guestPhone.replace(/\s+/g, '')
        const ghanaPhoneRegex = /^(0\d{9}|233\d{9})$/
        if (!ghanaPhoneRegex.test(cleanPhone)) {
            return NextResponse.json({ error: 'Invalid phone number. Use format: 0XXXXXXXXX or 233XXXXXXXXX' }, { status: 400 })
        }

        const supabase = createServerClient()
        const db = supabase as any

        // 1. Fetch shop + owner details (must be approved and active)
        const { data: shop, error: shopError } = await db
            .from('shop_profiles')
            .select(`
                id, shop_name, shop_slug, owner_id, approval_status, is_active, 
                fulfillment_mode, paystack_fee_percent, owner_phone, whatsapp_number,
                owner:users!shop_profiles_owner_id_fkey(role, email)
            `)
            .eq('shop_slug', shopSlug)
            .single()

        if (shopError || !shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        // Check if shop owner still has a valid role (agent or admin)
        const ownerRole = shop.owner?.role
        const isValidRole = ['agent', 'admin', 'sub-admin'].includes(ownerRole)

        if (shop.approval_status !== 'approved' || !shop.is_active || !isValidRole) {
            return NextResponse.json({
                error: 'This shop is not currently active',
                contact: {
                    phone: shop.owner_phone,
                    whatsapp: shop.whatsapp_number,
                    email: shop.owner?.email
                }
            }, { status: 403 })
        }

        // 2. Fetch package (must be available)
        const { data: pkg, error: pkgError } = await db
            .from('data_packages')
            .select('id, network, size, price, agent_price, cost_price, is_available')
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

        // Correct Logic: Shop's cost is the platform's selling price for the owner.
        // If owner is agent, use agent_price. Otherwise use regular price.
        const isAgentOwner = shop.owner?.role === 'agent' && parseFloat(pkg.agent_price) > 0
        const costPrice = isAgentOwner ? parseFloat(pkg.agent_price) : (parseFloat(pkg.price) || 0)
        const profit = sellingPrice - costPrice

        // === SECURITY: Explicit price guards ===
        if (sellingPrice <= 0 || isNaN(sellingPrice)) {
            console.error(`[Shop Initialize] SECURITY: Zero/negative selling price detected. Shop: ${shopSlug}, Package: ${packageId}, Price: ${sellingPrice}`)
            return NextResponse.json({ error: 'Invalid pricing configuration' }, { status: 400 })
        }

        if (profit <= 0) {
            return NextResponse.json({ error: 'Invalid shop pricing configuration: Selling price must be higher than updated cost price' }, { status: 400 })
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

        // 5. Initialize Paystack — use unique email for identity
        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
        if (!PAYSTACK_SECRET_KEY) {
            return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 })
        }

        // RESOLVE PAYSTACK EMAIL:
        // Priority: 1. Valid Guest Email, 2. Unique Synthetic Email
        let paystackEmail = ''
        if (validatedGuestEmail) {
            paystackEmail = validatedGuestEmail
        } else {
            // Synthetic email ensures EVERY transaction has a unique identity to prevent Paystack blocking.
            // Format: guest-{phone}-{timestamp}@shop.kingflexygh.com
            paystackEmail = `guest-${cleanPhone}-${Date.now()}@shop.kingflexygh.com`
        }

        const paystackRef = `SHOP-${shop.id.slice(0, 8)}-${Date.now()}`
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kingflexygh.com'
        const callbackUrl = `${appUrl}/api/shop/verify?ref=${paystackRef}&slug=${shopSlug}`

        console.log(`[Shop Initialize] Initializing Paystack. Email: ${paystackEmail}, Amount: ${totalAmount}, Ref: ${paystackRef}`)

        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: paystackEmail,
                amount: totalAmount,
                reference: paystackRef,
                callback_url: callbackUrl,
                metadata: {
                    shop_id: shop.id,
                    shop_name: shop.shop_name,
                    shop_slug: shopSlug,
                    guest_phone: cleanPhone,
                    guest_email: validatedGuestEmail, // Store the real email if provided
                    package_id: packageId,
                    network: pkg.network,
                    package_size: pkg.size,
                    selling_price: sellingPrice,
                    cost_price: costPrice,
                    profit: profit,
                    fulfillment_mode: shop.fulfillment_mode,
                    custom_fields: [
                        { display_name: 'Shop', variable_name: 'shop', value: shop.shop_name },
                        { display_name: 'Phone', variable_name: 'phone', value: cleanPhone },
                        { display_name: 'Package', variable_name: 'package', value: `${pkg.network} ${pkg.size}` },
                        ...(validatedGuestEmail ? [{ display_name: 'Email', variable_name: 'email', value: validatedGuestEmail }] : []),
                    ],
                },
            }),
        })

        const paystackData = await paystackRes.json()

        if (!paystackData.status || !paystackData.data?.authorization_url) {
            console.error('[Shop Initialize] Paystack error:', paystackData)
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
