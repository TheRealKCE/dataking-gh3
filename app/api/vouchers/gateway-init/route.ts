import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { calculateRCPrice, getRCTypeById } from '@/lib/vouchers/pricing'
import { initiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'

export async function POST(request: NextRequest) {
    try {
        const supabase = createRouteClient()

        // Attempt to get user session (optional for guest checkout)
        const { data: { session } } = await supabase.auth.getSession()
        let userId = null
        let userRole = 'customer'

        if (session) {
            userId = session.user.id
            const { data: userProfile } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .single()
            if (userProfile) {
                userRole = (userProfile as any).role || 'customer'
            }
        }

        const body = await request.json()
        const {
            typeId,
            quantity,
            customerName,
            customerEmail,
            customerPhone,
            gateway = 'paystack',  // 'paystack' | 'moolre'
            momoPhone,
            momoNetwork,
            otpCode,
        } = body

        if (!typeId || !quantity || quantity <= 0 || !customerEmail) {
            return NextResponse.json({ error: 'Invalid request payload. Email and quantity are required.' }, { status: 400 })
        }

        // Fetch and validate the voucher type
        const type = await getRCTypeById(supabase, typeId)
        if (!type || !type.is_active) {
            return NextResponse.json({ error: 'Product not available' }, { status: 400 })
        }

        // Calculate price — include gateway fee for Paystack, not for Moolre (Moolre fees are charged separately)
        const breakdown = await calculateRCPrice({
            type,
            quantity,
            userRole,
            includePaystackFee: gateway === 'paystack',
        })

        // Generate unique reference
        const referenceCode = `RC-${Date.now()}`

        // Insert pending order
        const { data: order, error: orderError } = await (supabase
            .from('results_checker_orders') as any)
            .insert({
                user_id: userId,
                user_role: userRole,
                customer_name: customerName || 'Guest Customer',
                customer_email: customerEmail,
                customer_phone: customerPhone,
                type_id: typeId,
                type_name: type.name,
                quantity,
                unit_price: breakdown.unitPrice,
                cost_price_at_time: type.cost_price,
                fee_amount: breakdown.paystackFee,
                total_paid: breakdown.total,
                status: 'pending',
                payment_status: 'pending_payment',
                reference_code: referenceCode,
            })
            .select()
            .single()

        if (orderError || !order) {
            console.error('[GatewayInit] Order creation failed:', orderError)
            return NextResponse.json({ error: 'Failed to initialize order' }, { status: 500 })
        }

        // ── PAYSTACK BRANCH ──────────────────────────────────────────────────────
        if (gateway === 'paystack') {
            const paystackPayload = {
                email: customerEmail,
                amount: Math.round(breakdown.total * 100), // Kobo
                reference: referenceCode,
                callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/transactions`,
                metadata: {
                    order_type: 'results_checker',
                    type_id: typeId,
                    quantity,
                },
            }

            const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(paystackPayload),
            })

            const paystackData = await paystackRes.json()

            if (!paystackData.status) {
                console.error('[GatewayInit] Paystack init failed:', paystackData)
                return NextResponse.json({ error: 'Payment gateway initialization failed' }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                gateway: 'paystack',
                authorization_url: paystackData.data.authorization_url,
                reference: referenceCode,
            })
        }

        // ── MOOLRE BRANCH ────────────────────────────────────────────────────────
        if (gateway === 'moolre') {
            if (!momoPhone || !momoNetwork || !MOOLRE_PAYMENT_CHANNEL_MAP[momoNetwork]) {
                return NextResponse.json({ error: 'Valid MoMo phone and network are required for mobile money payments' }, { status: 400 })
            }

            const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[momoNetwork]

            let moolreResponse = await initiatePayment({
                amount: breakdown.total,
                payerPhone: momoPhone,
                channel: channelId,
                externalRef: referenceCode,
                otpCode,
            })

            // If Moolre returned OTP verification success, send the actual payment request
            if (moolreResponse.success && String(moolreResponse.status) === '1' && otpCode) {
                console.log('[GatewayInit] Moolre OTP verified. Sending follow-up payment request.')
                moolreResponse = await initiatePayment({
                    amount: breakdown.total,
                    payerPhone: momoPhone,
                    channel: channelId,
                    externalRef: referenceCode,
                })
            }

            if (!moolreResponse.success) {
                console.error('[GatewayInit] Moolre error:', moolreResponse.error)
                return NextResponse.json({ error: moolreResponse.error || 'Failed to initialize mobile money payment' }, { status: 500 })
            }

            // OTP required — return so frontend can prompt the user
            if (moolreResponse.status === '200_OTP_REQ') {
                return NextResponse.json({
                    success: true,
                    gateway: 'moolre',
                    otpRequired: true,
                    reference: referenceCode,
                    message: 'OTP is required to complete this payment. Please enter the code sent to your phone.',
                })
            }

            // USSD prompt sent — user must approve on their phone
            return NextResponse.json({
                success: true,
                gateway: 'moolre',
                otpRequired: false,
                reference: referenceCode,
                message: 'Payment prompt sent to your phone. Please approve to complete your purchase.',
            })
        }

        return NextResponse.json({ error: 'Unsupported payment gateway' }, { status: 400 })

    } catch (error: any) {
        console.error('[GatewayInit] Error:', error)
        if (error.message === 'PRICING_ERROR_UNIT_BELOW_COST') {
            return NextResponse.json({ error: 'Pricing error. Please contact support.' }, { status: 500 })
        }
        return NextResponse.json({ error: 'Failed to process checkout' }, { status: 500 })
    }
}
