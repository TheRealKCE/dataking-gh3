import { createRouteHandlerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { generateReferenceCode } from '@/lib/utils'
import { initiatePayment as hubtelInitiatePayment, HUBTEL_CHANNEL_MAP } from '@/lib/hubtel-payment-service'
import { resolveSubAgentContext, type SubAgentContext } from '@/lib/sub-agents'

/**
 * USSD short-code activation — a one-time, lifetime purchase.
 *
 * Modelled on /api/user/upgrade/initialize: the wallet branch settles entirely
 * server-side, while the Hubtel branch leaves a pending `wallet_payments` row
 * that the Hubtel webhook settles through processCompletedUssdActivation.
 *
 * Mobile money always goes through Hubtel, matching the rest of the USSD stack.
 *
 * The reference is prefixed `ussd_activation_` (not `SHOPUSSD-`) so it routes
 * through the webhooks' existing wallet_payments lookup, which already does the
 * idempotency and paid-amount checks for every `*_upgrade_`-style purchase.
 */

const PRICE_KEYS = [
    'ussd_activation_price_customer',
    'ussd_activation_price_agent',
    'ussd_activation_price_dealer',
    'ussd_activation_price_sub',
] as const

/**
 * Sub-agents are priced on their membership, not their role: a sub's users.role
 * is 'customer', so without this they would pay the most expensive tier.
 */
function priceKeyForRole(role: string, isSub: boolean): string {
    if (isSub) return 'ussd_activation_price_sub'
    if (role === 'dealer' || role === 'dealership') return 'ussd_activation_price_dealer'
    if (role === 'agent') return 'ussd_activation_price_agent'
    return 'ussd_activation_price_customer'
}

const DEFAULT_PRICE: Record<string, number> = {
    ussd_activation_price_customer: 50,
    ussd_activation_price_agent: 40,
    ussd_activation_price_dealer: 30,
    ussd_activation_price_sub: 40,
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
        .in('key', [...PRICE_KEYS, 'ussd_dial_code'])

    const settingsMap: Record<string, any> = {}
    for (const row of (settings || [])) settingsMap[row.key] = row.value

    // Membership + the upline's live eligibility. A sub whose Lead has lapsed
    // could not sell through the code, so they must not be sold one.
    const sub = await resolveSubAgentContext(supabaseAdmin, authUser.id)

    const role = (dbUser as any)?.role || 'customer'
    const priceKey = priceKeyForRole(role, sub.isSub)
    const raw = settingsMap[priceKey]
    const price = raw !== undefined && raw !== '' ? Number(raw) : DEFAULT_PRICE[priceKey]

    return { authUser, supabaseAdmin, shop: shop as any, role, price, settingsMap, sub }
}

/**
 * The reason a caller cannot activate right now, or null when they can.
 *
 * A sub is gated on their OWN membership only. Deliberately NOT gated on the
 * upline's canOwnSubNetwork() eligibility: almost every live Lead is role
 * 'customer' with no dealer subscription, yet their networks sell every day —
 * the sub's storefront applies no such check either, so enforcing it at the
 * short-code till would block paying subs for a state they cannot fix.
 */
function activationBlockReason(shop: any, sub: SubAgentContext): string | null {
    if (!shop) return 'You need a shop before you can activate a short code'
    if (shop.approval_status !== 'approved') return 'Your shop must be approved before activating a short code'
    if (sub.isSub && sub.status !== 'active') {
        return sub.status === 'suspended'
            ? 'Your sub-agent account is suspended. Contact your Lead to be reinstated.'
            : 'Your account is still awaiting approval from your Lead'
    }
    return null
}

/** Lets the dashboard show the caller's price and activation state without exposing prices publicly. */
export async function GET() {
    try {
        const ctx = await loadContext()
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

        const { shop, role, price, settingsMap, sub } = ctx
        const blockedReason = activationBlockReason(shop, sub)

        return NextResponse.json({
            success: true,
            hasShop: !!shop,
            eligible: !blockedReason,
            // Lets the portal explain the block instead of guessing at
            // "awaiting approval", which is only one of several reasons.
            reason: blockedReason,
            isSub: sub.isSub,
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

        const { authUser, supabaseAdmin, shop, price, settingsMap, sub } = ctx

        const blockedReason = activationBlockReason(shop, sub)
        if (blockedReason) {
            // A sub blocked on membership is a 403 (they may not trade at all);
            // a missing/unapproved shop is a 400 (fix the shop and come back).
            const status = sub.isSub && shop && shop.approval_status === 'approved' ? 403 : 400
            return NextResponse.json({ error: blockedReason }, { status })
        }
        if (shop.ussd_status === 'active') {
            return NextResponse.json({ error: 'Your short code is already active' }, { status: 400 })
        }
        if (!(price > 0)) {
            return NextResponse.json({ error: 'Activation is not available right now. Please contact support.' }, { status: 503 })
        }

        const { phone, network, paymentMethod } = await request.json().catch(() => ({}))

        const isWalletPayment = paymentMethod === 'wallet'

        if (!isWalletPayment && (!phone || !network || !HUBTEL_CHANNEL_MAP[network])) {
            return NextResponse.json({ error: 'Phone number and network are required' }, { status: 400 })
        }

        // Always minted server-side. The upgrade route this was modelled on accepts
        // a client reference to resubmit after a Moolre OTP step; Hubtel has no OTP,
        // so honouring one here would only let a caller collide with a payment row.
        const reference = `ussd_activation_${generateReferenceCode()}`

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

        // ── HUBTEL BRANCH ────────────────────────────────────────────────────────
        // Activation always prompts through Hubtel, matching the rest of the USSD
        // stack. It deliberately ignores active_payment_provider_web: this purchase
        // only ever collects a phone + network, so routing it to a card gateway
        // would strand the caller on a checkout page they never asked for.
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
                provider: 'hubtel',
                status: 'pending',
                metadata: activationMetadata,
            })

        if (paymentError) {
            console.error('[UssdActivate] Database error:', paymentError)
            throw new Error('Failed to record payment attempt')
        }

        const hubtelResponse = await hubtelInitiatePayment({
            amount: price,
            payerPhone: phone,
            channel: HUBTEL_CHANNEL_MAP[network],
            clientReference: reference,
            // toHubtelSafeText sanitises this, but keeping it ASCII at the source
            // avoids the failure mode where a bad Description makes the call throw
            // `terminated` after the payment has already gone live.
            description: 'ARHMS USSD Short Code Activation',
            userId: authUser.id,
        })

        if (!hubtelResponse.success) {
            await (supabaseAdmin.from('wallet_payments') as any).update({ status: 'failed' }).eq('reference', reference)
            throw new Error(hubtelResponse.error || 'Failed to initialize Hubtel payment')
        }

        return NextResponse.json({
            success: true,
            gateway: 'hubtel',
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
