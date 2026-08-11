import { createRouteHandlerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { generateReferenceCode } from '@/lib/utils'
import { initiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'
import { initiatePayment as hubtelInitiatePayment, HUBTEL_CHANNEL_MAP } from '@/lib/hubtel-payment-service'
import { initiatePayment as payswitchInitiatePayment, PAYSWITCH_CHANNEL_MAP } from '@/lib/payswitch-payment-service'
import { assignPayswitchTransactionId } from '@/lib/payswitch-reference'
import { resolveProvider, isPaymentProvider, type PaymentProvider } from '@/lib/payment-provider'

/**
 * USSD short-code activation — a one-time, lifetime purchase.
 *
 * Modelled on /api/user/upgrade/initialize: the wallet branch settles entirely
 * server-side, while the gateway branches leave a pending `wallet_payments` row
 * that the provider webhook settles through processCompletedUssdActivation.
 *
 * The reference is prefixed `ussd_activation_` (not `SHOPUSSD-`) so it routes
 * through the webhooks' existing wallet_payments lookup, which already does the
 * idempotency and paid-amount checks for every `*_upgrade_`-style purchase.
 */

const PRICE_KEYS = [
    'ussd_activation_price_customer',
    'ussd_activation_price_agent',
    'ussd_activation_price_dealer',
] as const

function priceKeyForRole(role: string): string {
    if (role === 'dealer' || role === 'dealership') return 'ussd_activation_price_dealer'
    if (role === 'agent') return 'ussd_activation_price_agent'
    return 'ussd_activation_price_customer'
}

const DEFAULT_PRICE: Record<string, number> = {
    ussd_activation_price_customer: 50,
    ussd_activation_price_agent: 40,
    ussd_activation_price_dealer: 30,
}

async function loadContext() {
    const supabase = await createRouteHandlerClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return { error: 'Unauthorized' as const, status: 401 }

    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: dbUser } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

    const { data: shop } = await supabaseAdmin
        .from('shop_profiles')
        .select('id, shop_name, approval_status, is_active, ussd_status, ussd_code')
        .eq('owner_id', authUser.id)
        .maybeSingle()

    const { data: settings } = await supabaseAdmin
        .from('admin_settings')
        .select('key, value')
        .in('key', [...PRICE_KEYS, 'ussd_dial_code', 'active_payment_provider_web'])

    const settingsMap: Record<string, any> = {}
    for (const row of (settings || [])) settingsMap[row.key] = row.value

    const role = (dbUser as any)?.role || 'customer'
    const priceKey = priceKeyForRole(role)
    const raw = settingsMap[priceKey]
    const price = raw !== undefined && raw !== '' ? Number(raw) : DEFAULT_PRICE[priceKey]

    return { authUser, supabaseAdmin, shop: shop as any, role, price, settingsMap }
}

/** Lets the dashboard show the caller's price and activation state without exposing prices publicly. */
export async function GET() {
    try {
        const ctx = await loadContext()
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

        const { shop, role, price, settingsMap } = ctx

        return NextResponse.json({
            success: true,
            hasShop: !!shop,
            eligible: !!shop && shop.approval_status === 'approved',
            status: shop?.ussd_status || 'inactive',
            shortCode: shop?.ussd_code || null,
            dialCode: settingsMap.ussd_dial_code || '',
            role,
            price,
        })
    } catch (error: any) {
        console.error('[UssdActivate] GET error:', error)
        return NextResponse.json({ error: 'Failed to load activation details' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const ctx = await loadContext()
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

        const { authUser, supabaseAdmin, shop, price, settingsMap } = ctx

        if (!shop) {
            return NextResponse.json({ error: 'You need a shop before you can activate a short code' }, { status: 400 })
        }
        if (shop.approval_status !== 'approved') {
            return NextResponse.json({ error: 'Your shop must be approved before activating a short code' }, { status: 400 })
        }
        if (shop.ussd_status === 'active') {
            return NextResponse.json({ error: 'Your short code is already active' }, { status: 400 })
        }
        if (!(price > 0)) {
            return NextResponse.json({ error: 'Activation is not available right now. Please contact support.' }, { status: 503 })
        }

        const {
            phone,
            network,
            otpCode,
            reference: existingRef,
            provider: bodyProvider,
            paymentMethod,
        } = await request.json().catch(() => ({}))

        const isWalletPayment = paymentMethod === 'wallet'

        const provider: PaymentProvider =
            isPaymentProvider(bodyProvider) && bodyProvider !== 'moolre'
                ? bodyProvider
                : resolveProvider(settingsMap.active_payment_provider_web)

        if (!isWalletPayment) {
            const channelMap =
                provider === 'moolre' ? MOOLRE_PAYMENT_CHANNEL_MAP
                    : provider === 'hubtel' ? HUBTEL_CHANNEL_MAP
                        : provider === 'payswitch' ? PAYSWITCH_CHANNEL_MAP
                            : null
            if (channelMap && (!phone || !network || !channelMap[network])) {
                return NextResponse.json({ error: 'Phone number and network are required' }, { status: 400 })
            }
        }

        const reference = existingRef || `ussd_activation_${generateReferenceCode()}`

        const activationMetadata = {
            user_id: authUser.id,
            upgrade_type: 'ussd_activation',
            shop_id: shop.id,
            shop_name: shop.shop_name,
            base_amount: price,
            fee: 0,
        }

        // ── WALLET BRANCH ────────────────────────────────────────────────────────
        if (isWalletPayment) {
            // Atomic: the RPC only deducts when the balance covers it, so two
            // concurrent attempts cannot both succeed on one balance.
            const { data: deductResult, error: deductError } = await (supabaseAdmin as any)
                .rpc('deduct_wallet_balance', { p_user_id: authUser.id, p_amount: price })

            if (deductError) {
                if (deductError.message?.includes('INSUFFICIENT_BALANCE')) {
                    return NextResponse.json(
                        { error: `Insufficient wallet balance. You need GHS ${price.toFixed(2)} to activate.` },
                        { status: 400 }
                    )
                }
                console.error('[UssdActivate] Wallet deduction error:', deductError)
                return NextResponse.json({ error: 'Failed to process wallet payment' }, { status: 500 })
            }

            const walletRow = deductResult?.[0] || deductResult
            const walletId = walletRow?.wallet_id
            if (!walletId) {
                return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
            }

            // The money has already left the balance by this point, so anything
            // that fails after the debit must put it back.
            const refund = async (why: string) => {
                console.error(`[UssdActivate] Refunding wallet activation (${why}):`, reference)
                const { error: refundError } = await (supabaseAdmin as any)
                    .rpc('credit_wallet_balance', { p_user_id: authUser.id, p_amount: price })
                if (refundError) {
                    console.error('CRITICAL: activation refund RPC failed for', reference, refundError)
                }
            }

            const { error: paymentInsertError } = await (supabaseAdmin.from('wallet_payments') as any)
                .insert({
                    user_id: authUser.id,
                    wallet_id: walletId,
                    amount: price,
                    fee: 0,
                    total_amount: price,
                    reference,
                    provider: 'wallet',
                    status: 'pending',
                    metadata: { ...activationMetadata, paid_from: 'wallet' },
                })

            if (paymentInsertError) {
                console.error('[UssdActivate] wallet_payments insert failed:', paymentInsertError)
                await refund('payment record insert failed')
                return NextResponse.json({ error: 'Failed to record activation payment' }, { status: 500 })
            }

            ;(supabaseAdmin.from('wallet_transactions') as any).insert({
                wallet_id: walletId,
                user_id: authUser.id,
                type: 'debit',
                amount: price,
                description: 'USSD short code activation (lifetime)',
                reference,
                source: 'purchase',
                status: 'completed',
            }).then(({ error }: any) => {
                if (error) console.error('[UssdActivate] wallet_transactions insert failed:', error)
            })

            const { processCompletedUssdActivation } = await import('@/lib/payments')
            const result = await processCompletedUssdActivation(reference, {
                reference,
                amount: Math.round(price * 100),
                metadata: { ...activationMetadata, paid_from: 'wallet' },
            })

            if (!result?.success) {
                console.error('[UssdActivate] Activation processing failed:', result?.error)
                await (supabaseAdmin.from('wallet_payments') as any)
                    .update({ status: 'failed' })
                    .eq('reference', reference)
                await refund('activation processing failed')
                return NextResponse.json(
                    { error: result?.error || 'Failed to activate your short code. Your wallet has been refunded.' },
                    { status: 500 }
                )
            }

            return NextResponse.json({
                success: true,
                gateway: 'wallet',
                activated: true,
                reference,
                shortCode: result.shortCode,
                dialCode: settingsMap.ussd_dial_code || '',
                message: `Your USSD short code is ${result.shortCode}.`,
            })
        }

        // ── GATEWAY BRANCHES ─────────────────────────────────────────────────────
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', authUser.id)
            .single()

        if (!wallet) throw new Error('User wallet not found')

        const { error: paymentError } = await (supabaseAdmin.from('wallet_payments') as any)
            .insert({
                user_id: authUser.id,
                wallet_id: (wallet as any).id,
                amount: price,
                fee: 0,
                total_amount: price,
                reference,
                provider,
                status: 'pending',
                metadata: activationMetadata,
            })

        if (!existingRef && paymentError) {
            console.error('[UssdActivate] Database error:', paymentError)
            throw new Error('Failed to record payment attempt')
        }

        if (provider === 'paystack') {
            const { data: userProfile } = await supabaseAdmin
                .from('users')
                .select('email')
                .eq('id', authUser.id)
                .single()

            const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: (userProfile as any)?.email,
                    amount: Math.round(price * 100),
                    reference,
                    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/shop/ussd?reference=${reference}`,
                    metadata: { upgrade_type: 'ussd_activation', shop_id: shop.id },
                }),
            })

            const paystackData = await paystackRes.json()

            if (!paystackData.status) {
                console.error('[UssdActivate] Paystack init failed:', paystackData)
                await (supabaseAdmin.from('wallet_payments') as any).update({ status: 'failed' }).eq('reference', reference)
                return NextResponse.json({ error: 'Payment gateway error' }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                gateway: 'paystack',
                authorization_url: paystackData.data.authorization_url,
                reference,
            })
        }

        if (provider === 'hubtel') {
            const hubtelResponse = await hubtelInitiatePayment({
                amount: price,
                payerPhone: phone,
                channel: HUBTEL_CHANNEL_MAP[network],
                clientReference: reference,
                // ASCII only: non-ASCII in Description makes the Hubtel call throw
                // `terminated` after the payment has already gone live.
                description: 'ARHMS USSD Short Code Activation',
                userId: authUser.id,
            })

            if (!hubtelResponse.success) {
                throw new Error(hubtelResponse.error || 'Failed to initialize Hubtel payment')
            }

            return NextResponse.json({
                success: true,
                gateway: 'hubtel',
                reference,
                message: 'Payment prompt sent to your phone. Please approve to continue.',
            })
        }

        if (provider === 'payswitch') {
            const { transactionId, error: txIdError } = await assignPayswitchTransactionId(supabaseAdmin, { reference })
            if (!transactionId) {
                console.error('[UssdActivate] PaySwitch transaction id error:', txIdError)
                await (supabaseAdmin.from('wallet_payments') as any).update({ status: 'failed' }).eq('reference', reference)
                throw new Error('Could not start the payment. Please try again.')
            }

            const payswitchResponse = await payswitchInitiatePayment({
                amount: price,
                payerPhone: phone,
                network,
                transactionId,
                description: 'ARHMS USSD Short Code Activation',
            })

            if (!payswitchResponse.success) {
                await (supabaseAdmin.from('wallet_payments') as any).update({ status: 'failed' }).eq('reference', reference)
                throw new Error(payswitchResponse.error || 'Failed to initialize PaySwitch payment')
            }

            return NextResponse.json({
                success: true,
                gateway: 'payswitch',
                reference,
                message: 'Payment prompt sent to your phone. Please approve to continue.',
            })
        }

        // ── MOOLRE ───────────────────────────────────────────────────────────────
        const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[network]

        let moolreResponse = await initiatePayment({
            amount: price,
            payerPhone: phone,
            channel: channelId,
            externalRef: reference,
            otpCode,
        })

        if (moolreResponse.success && String(moolreResponse.status) === '1' && otpCode) {
            moolreResponse = await initiatePayment({
                amount: price,
                payerPhone: phone,
                channel: channelId,
                externalRef: reference,
            })
        }

        if (!moolreResponse.success) {
            throw new Error(moolreResponse.error || 'Failed to initialize payment')
        }

        if (moolreResponse.status === '200_OTP_REQ') {
            return NextResponse.json({
                success: true,
                gateway: 'moolre',
                otpRequired: true,
                reference,
                message: 'OTP is required to complete this payment. Please enter the code sent to your phone.',
            })
        }

        return NextResponse.json({
            success: true,
            gateway: 'moolre',
            reference,
            message: 'Payment prompt sent to your phone. Please approve to continue.',
        })
    } catch (error: any) {
        console.error('[UssdActivate] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to start activation' },
            { status: 500 }
        )
    }
}
