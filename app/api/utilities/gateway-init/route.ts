import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { calculatePaystackFee, generateReferenceCode } from '@/lib/utils'
import { initiatePayment as moolreInitiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'
import { initiatePayment as hubtelInitiatePayment, HUBTEL_CHANNEL_MAP, calculateHubtelFee, toHubtelMsisdn } from '@/lib/hubtel-payment-service'
import { checkHubtelPromptLimit, recordHubtelPrompt } from '@/lib/hubtel-prompt-limit'
import { initiatePayment as payswitchInitiatePayment, PAYSWITCH_CHANNEL_MAP } from '@/lib/payswitch-payment-service'
import { assignPayswitchTransactionId } from '@/lib/payswitch-reference'
import { resolveProviderForScope, type PaymentProvider } from '@/lib/payment-provider'
import { WEB_FEE_SETTING_KEYS, resolveWebFeePercent } from '@/lib/gateway-fees'
import { buildUtilityIntent, utilitySettingKeys, isUtilityVisibleTo, UTILITY_LAUNCH_KEY } from '@/lib/utility-order-intent'

/**
 * Direct-pay (MoMo / card) utility bill payment.
 *
 * Mirrors app/api/orders/gateway-init/route.ts: no `utility_orders` row is written
 * here, only a pending `wallet_payments` intent whose metadata carries everything
 * needed to build the order later. processUtilityDirectOrder() in
 * lib/utility-order-payments.ts creates the real order once the gateway confirms
 * payment, and is the only thing that ever spends from the prepaid account.
 *
 * The reference is `UTIL-…` — that prefix is what routes the callback in every
 * collection webhook and reconciliation poller.
 *
 * Ghana Water's sessionId is looked up here so the bill can be priced against a live
 * account, but it is NOT stored for reuse: it is single-use and the settle path
 * fetches its own after the customer has approved the prompt.
 */
export async function POST(request: NextRequest) {
    if (process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true') {
        return NextResponse.json(
            { error: 'Payment system is currently under maintenance. Please try again later.' },
            { status: 503 }
        )
    }

    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id
        const supabase = createServerClient() as any

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const {
            service, accountNumber, amount, phone, email,
            momoPhone, momoNetwork, otpCode, reference: existingRef,
        } = body

        if (typeof service !== 'string') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // ── Load profile + settings ───────────────────────────────────────────
        const [{ data: profile }, { data: settingsRows }] = await Promise.all([
            supabase.from('users').select('email, first_name, last_name, phone_number, role').eq('id', userId).single(),
            supabase.from('admin_settings').select('key, value').in('key', [
                ...utilitySettingKeys(service),
                ...WEB_FEE_SETTING_KEYS,
                'active_payment_provider_web',
                UTILITY_LAUNCH_KEY,
            ]),
        ])

        const settings: Record<string, any> = {}
        for (const row of (settingsRows || [])) settings[row.key] = row.value

        // Live in production but not yet open — a hidden page is not a closed one,
        // and this is the route that moves money.
        if (!isUtilityVisibleTo(profile?.role, settings)) {
            return NextResponse.json({ error: 'Bill payments are not available yet.' }, { status: 403 })
        }

        const userRole: 'agent' | 'customer' = profile?.role === 'agent' ? 'agent' : 'customer'
        const gateway: PaymentProvider = resolveProviderForScope(settings.active_payment_provider_web, 'web')

        // ── Validate + verify + price (all server-side) ───────────────────────
        const built = await buildUtilityIntent({ service, accountNumber, amount, phone, email }, settings, userRole)
        if (!built.ok) {
            return NextResponse.json({ error: built.error }, { status: built.status })
        }
        const intent = built.intent

        // ── Gateway fee on top of our own fee ─────────────────────────────────
        // Same rule as the data checkout: Paystack and Hubtel charge us, Moolre and
        // PaySwitch charge the payer directly.
        const subtotal = intent.totalPaid
        let gatewayFee = 0
        let totalAmount = subtotal

        if (gateway === 'paystack' || gateway === 'paystack_momo') {
            // fallbackPercent 0 preserves this route's original `|| '0'`: an
            // unconfigured key has always meant a free utility transfer here, unlike
            // the wallet and data flows which fall back to 1.95.
            const feePercent = resolveWebFeePercent(settings, {
                role: userRole,
                provider: gateway,
                fallbackPercent: 0,
            })
            gatewayFee = calculatePaystackFee(subtotal, feePercent)
            totalAmount = parseFloat((subtotal + gatewayFee).toFixed(2))
        } else if (gateway === 'hubtel') {
            const hubtelFee = calculateHubtelFee(subtotal)
            gatewayFee = hubtelFee.fee
            totalAmount = hubtelFee.total
        }

        // ── Get or create wallet (wallet_payments needs a wallet_id) ──────────
        let { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', userId).single()
        if (!wallet) {
            const { data: newWallet, error: walletError } = await supabase
                .from('wallets')
                .insert({ user_id: userId })
                .select()
                .single()
            if (walletError || !newWallet) {
                console.error('[UtilityGatewayInit] Wallet create failed:', walletError?.message)
                return NextResponse.json({ error: 'Failed to initialize payment. Please try again.' }, { status: 500 })
            }
            wallet = newWallet
        }

        // ── Create (or reuse, on OTP retry) the payment intent ────────────────
        const reference = existingRef || `UTIL-${generateReferenceCode()}`
        let paymentId: string | null = null

        if (existingRef) {
            if (!String(existingRef).startsWith('UTIL-')) {
                return NextResponse.json({ error: 'Invalid payment reference' }, { status: 400 })
            }
            const { data: existingPayment } = await supabase
                .from('wallet_payments')
                .select('id, user_id, status')
                .eq('reference', existingRef)
                .single()

            if (existingPayment) {
                if (existingPayment.user_id !== userId) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
                }
                if (existingPayment.status !== 'pending') {
                    return NextResponse.json({ error: 'This payment has already been processed' }, { status: 400 })
                }
                paymentId = existingPayment.id
            }
        }

        // Everything processUtilityDirectOrder needs to build the order. The
        // sessionId is deliberately absent — see the note at the top of this file.
        const intentMetadata = {
            kind: 'utility_order',
            user_id: userId,
            role: userRole,
            service: intent.service,
            account_number: intent.accountNumber,
            account_name: intent.accountName,
            destination: intent.destination,
            customer_phone: intent.customerPhone,
            customer_email: intent.customerEmail,
            bill_amount: intent.billAmount,
            fee_rate: intent.feeRate,
            fee_amount: intent.feeAmount,
        }

        if (!paymentId) {
            const { data: payment, error: paymentError } = await supabase
                .from('wallet_payments')
                .insert({
                    user_id: userId,
                    wallet_id: wallet.id,
                    amount: subtotal,
                    fee: gatewayFee,
                    total_amount: totalAmount,
                    reference,
                    provider: gateway,
                    status: 'pending',
                    metadata: intentMetadata,
                })
                .select()
                .single()

            if (paymentError || !payment) {
                console.error('[UtilityGatewayInit] wallet_payments insert error:', paymentError?.message)
                return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
            }
            paymentId = payment.id
        }

        const description = `ARHMS ${intent.label} - ${intent.accountNumber}`

        // ── PAYSTACK ──────────────────────────────────────────────────────────
        if (gateway === 'paystack') {
            if (!process.env.PAYSTACK_SECRET_KEY || !process.env.NEXT_PUBLIC_APP_URL) {
                console.error('[UtilityGatewayInit] Paystack env vars missing')
                return NextResponse.json({ error: 'Payment gateway is not configured. Please contact support.' }, { status: 503 })
            }

            const userEmail = profile?.email
            if (!userEmail) {
                return NextResponse.json(
                    { error: 'Account email is required for card payment. Please update your profile.' },
                    { status: 400 }
                )
            }

            const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: userEmail,
                    amount: Math.round(totalAmount * 100), // pesewas
                    reference,
                    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/utilities?reference=${reference}`,
                    metadata: { order_type: 'utility_order', service: intent.service },
                }),
            })

            const paystackData = await paystackRes.json()

            if (!paystackData.status) {
                console.error('[UtilityGatewayInit] Paystack init failed:', paystackData?.message)
                await supabase.from('wallet_payments').update({ status: 'failed' }).eq('id', paymentId)
                return NextResponse.json({ error: 'Payment gateway initialization failed' }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                gateway: 'paystack',
                authorization_url: paystackData.data.authorization_url,
                reference,
                amount: totalAmount,
                fee: gatewayFee,
            })
        }

        // ── HUBTEL ────────────────────────────────────────────────────────────
        if (gateway === 'hubtel') {
            if (!momoNetwork || !HUBTEL_CHANNEL_MAP[momoNetwork]) {
                return NextResponse.json({ error: 'Valid Mobile Money network is required' }, { status: 400 })
            }

            const payerPhone = toHubtelMsisdn(momoPhone || '') || momoPhone
            if (!payerPhone) {
                return NextResponse.json({ error: 'Please provide a Mobile Money phone number.' }, { status: 400 })
            }

            const promptLimit = await checkHubtelPromptLimit(payerPhone)
            if (!promptLimit.allowed) {
                await supabase.from('wallet_payments').update({ status: 'failed' }).eq('id', paymentId)
                return NextResponse.json({ error: promptLimit.error }, { status: 429 })
            }

            // Read-modify-write: this metadata carries the bill details the settle
            // path depends on, so it must be merged, never replaced.
            const { data: currentPayment } = await supabase
                .from('wallet_payments')
                .select('metadata')
                .eq('id', paymentId)
                .single()
            await supabase
                .from('wallet_payments')
                .update({
                    metadata: { ...(currentPayment?.metadata || {}), payer_msisdn: toHubtelMsisdn(payerPhone) },
                })
                .eq('id', paymentId)

            const hubtelResponse = await hubtelInitiatePayment({
                amount: totalAmount,
                payerPhone,
                channel: HUBTEL_CHANNEL_MAP[momoNetwork],
                clientReference: reference,
                customerName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Customer',
                customerEmail: profile?.email || '',
                description,
                userId,
            })

            if (!hubtelResponse.success) {
                console.error('[UtilityGatewayInit] Hubtel error:', hubtelResponse.error)
                await supabase.from('wallet_payments').update({ status: 'failed' }).eq('id', paymentId)
                return NextResponse.json({ error: hubtelResponse.error || 'Failed to initialize Hubtel payment' }, { status: 500 })
            }

            await recordHubtelPrompt(payerPhone)

            return NextResponse.json({
                success: true,
                gateway: 'hubtel',
                otpRequired: false,
                reference,
                amount: totalAmount,
                fee: gatewayFee,
                message: 'Payment prompt sent to your phone. Please approve to complete your bill payment.',
            })
        }

        // ── PAYSWITCH ─────────────────────────────────────────────────────────
        if (gateway === 'payswitch') {
            if (!momoPhone || !momoNetwork || !PAYSWITCH_CHANNEL_MAP[momoNetwork]) {
                return NextResponse.json({ error: 'Valid Mobile Money phone number and network are required' }, { status: 400 })
            }

            const { transactionId, error: txIdError } = await assignPayswitchTransactionId(supabase, { id: paymentId! })
            if (!transactionId) {
                console.error('[UtilityGatewayInit] PaySwitch transaction id error:', txIdError)
                await supabase.from('wallet_payments').update({ status: 'failed' }).eq('id', paymentId)
                return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 })
            }

            const payswitchResponse = await payswitchInitiatePayment({
                amount: totalAmount,
                payerPhone: momoPhone,
                network: momoNetwork,
                transactionId,
                description,
            })

            if (!payswitchResponse.success) {
                console.error('[UtilityGatewayInit] PaySwitch error:', payswitchResponse.error)
                await supabase.from('wallet_payments').update({ status: 'failed' }).eq('id', paymentId)
                return NextResponse.json({ error: payswitchResponse.error || 'Failed to initialize PaySwitch payment' }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                gateway: 'payswitch',
                otpRequired: false,
                reference,
                amount: totalAmount,
                fee: gatewayFee,
                message: 'Payment prompt sent to your phone. Please approve to complete your bill payment.',
            })
        }

        // ── MOOLRE ────────────────────────────────────────────────────────────
        if (!momoPhone || !momoNetwork || !MOOLRE_PAYMENT_CHANNEL_MAP[momoNetwork]) {
            return NextResponse.json(
                { error: 'Valid MoMo phone number and network are required for mobile money payments' },
                { status: 400 }
            )
        }

        const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[momoNetwork]

        let moolreResponse = await moolreInitiatePayment({
            amount: totalAmount,
            payerPhone: momoPhone,
            channel: channelId,
            externalRef: reference,
            otpCode,
        })

        // OTP just verified — send the actual payment request
        if (moolreResponse.success && String(moolreResponse.status) === '1' && otpCode) {
            moolreResponse = await moolreInitiatePayment({
                amount: totalAmount,
                payerPhone: momoPhone,
                channel: channelId,
                externalRef: reference,
            })
        }

        if (!moolreResponse.success) {
            console.error('[UtilityGatewayInit] Moolre error:', moolreResponse.error)
            await supabase.from('wallet_payments').update({ status: 'failed' }).eq('id', paymentId)
            return NextResponse.json({ error: moolreResponse.error || 'Failed to initialize mobile money payment' }, { status: 500 })
        }

        if (moolreResponse.status === '200_OTP_REQ') {
            return NextResponse.json({
                success: true,
                gateway: 'moolre',
                otpRequired: true,
                reference,
                amount: totalAmount,
                fee: gatewayFee,
                message: 'OTP is required to complete this payment. Please enter the code sent to your phone.',
            })
        }

        return NextResponse.json({
            success: true,
            gateway: 'moolre',
            otpRequired: false,
            reference,
            amount: totalAmount,
            fee: gatewayFee,
            message: 'Payment prompt sent to your phone. Please approve to complete your bill payment.',
        })
    } catch (error: any) {
        console.error('[UtilityGatewayInit] Error:', error)
        return NextResponse.json({ error: 'Failed to process checkout' }, { status: 500 })
    }
}
