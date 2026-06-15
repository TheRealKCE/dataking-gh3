import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { calculatePaystackFee, generateReferenceCode } from '@/lib/utils'
import { initiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'

// Build admin client safely — returns null with an error string if env vars are missing
function buildAdminClient(): { client: ReturnType<typeof createClient> | null; error: string | null } {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) return { client: null, error: 'NEXT_PUBLIC_SUPABASE_URL is not set on server' }
    if (!key) return { client: null, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on server' }
    return {
        client: createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }),
        error: null,
    }
}

export async function POST(request: NextRequest) {
    // ── Step 0: Maintenance mode ──────────────────────────────────────────────
    if (process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true') {
        return NextResponse.json(
            { error: 'Payment system is currently under maintenance. Please try again later.' },
            { status: 503 }
        )
    }

    // ── Step 1: Build admin client (checks env vars without throwing) ─────────
    const { client, error: adminError } = buildAdminClient()
    if (!client) {
        console.error('[WalletInit] Admin client error:', adminError)
        return NextResponse.json(
            { error: 'Server configuration error. Please contact support. (DB)' },
            { status: 503 }
        )
    }
    const supabaseAdmin = client as any

    try {
        // ── Step 2: Parse request body ────────────────────────────────────────
        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }
        const { amount, phone, network, otpCode, reference: existingRef } = body

        // ── Step 3: Validate amount ───────────────────────────────────────────
        const MAX_TOPUP_AMOUNT = Number(process.env.MAX_WALLET_TOPUP_AMOUNT) || 10000
        if (!amount || typeof amount !== 'number' || amount < 5 || amount > MAX_TOPUP_AMOUNT) {
            return NextResponse.json(
                { error: `Amount must be between GHS 5 and GHS ${MAX_TOPUP_AMOUNT.toLocaleString()}` },
                { status: 400 }
            )
        }

        // ── Step 4: Authenticate user ─────────────────────────────────────────
        const supabase = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        if (!authUser) {
            console.error('[WalletInit] Auth failed:', authError?.message)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const userId = authUser.id

        // ── Step 5: Load user profile + settings ──────────────────────────────
        const [{ data: user }, { data: userRoleData }, { data: feeData }] = await Promise.all([
            supabaseAdmin.from('users' as any).select('email').eq('id', userId).single(),
            supabaseAdmin.from('users' as any).select('role').eq('id', userId).single(),
            supabaseAdmin.from('admin_settings' as any).select('key, value').in('key', [
                'paystack_fee_percent',
                'agent_paystack_fee_percent',
                'active_payment_provider_web',
            ]),
        ])

        const settingsMap: Record<string, any> = {}
        for (const row of ((feeData as any[]) || [])) settingsMap[row.key] = row.value

        const provider = String(settingsMap.active_payment_provider_web || 'moolre') === 'paystack' ? 'paystack' : 'moolre'
        console.log('[WalletInit] provider:', provider, '| userId:', userId)

        // ── Step 6: Validate provider-specific inputs ─────────────────────────
        if (provider === 'moolre' && (!phone || !network || !MOOLRE_PAYMENT_CHANNEL_MAP[network])) {
            return NextResponse.json({ error: 'Valid phone number and network are required' }, { status: 400 })
        }

        if (provider === 'paystack') {
            if (!process.env.PAYSTACK_SECRET_KEY) {
                console.error('[WalletInit] PAYSTACK_SECRET_KEY missing on Vercel!')
                return NextResponse.json(
                    { error: 'Payment gateway is not configured on this server. Please contact support.' },
                    { status: 503 }
                )
            }
            if (!process.env.NEXT_PUBLIC_APP_URL) {
                console.error('[WalletInit] NEXT_PUBLIC_APP_URL missing on Vercel!')
                return NextResponse.json(
                    { error: 'App URL is not configured on this server. Please contact support.' },
                    { status: 503 }
                )
            }
        }

        // ── Step 7: Get or create wallet ──────────────────────────────────────
        let { data: wallet } = await (supabaseAdmin.from('wallets' as any))
            .select('id')
            .eq('user_id', userId)
            .single()

        if (!wallet) {
            const { data: newWallet, error: walletError } = await (supabaseAdmin.from('wallets' as any))
                .insert({ user_id: userId })
                .select()
                .single()
            if (walletError || !newWallet) {
                console.error('[WalletInit] Wallet create failed:', walletError?.message)
                return NextResponse.json({ error: 'Failed to initialize wallet. Please try again.' }, { status: 500 })
            }
            wallet = newWallet
        }

        // ── Step 8: Calculate fees ────────────────────────────────────────────
        const feeKey = (userRoleData as any)?.role === 'agent' ? 'agent_paystack_fee_percent' : 'paystack_fee_percent'
        const feeSetting = settingsMap[feeKey] ?? settingsMap['paystack_fee_percent']
        let feePercent = 1.95
        if (feeSetting !== undefined && feeSetting !== null) {
            const parsed = typeof feeSetting === 'string' ? parseFloat(feeSetting) : Number(feeSetting)
            if (!isNaN(parsed)) feePercent = parsed
        }

        const fee = calculatePaystackFee(amount, feePercent)
        const totalAmount = amount + fee
        const reference = existingRef || `WAL-${generateReferenceCode()}`
        let paymentId: string | null = null

        // ── Step 9: Find or create wallet_payments record ─────────────────────
        if (existingRef) {
            const { data: existingPayment } = await (supabaseAdmin.from('wallet_payments' as any))
                .select('id')
                .eq('reference', existingRef)
                .single()
            if (existingPayment) paymentId = (existingPayment as any).id
        }

        if (!paymentId) {
            const { data: payment, error: paymentError } = await (supabaseAdmin.from('wallet_payments' as any))
                .insert({
                    user_id: userId,
                    wallet_id: (wallet as any).id,
                    amount,
                    fee,
                    total_amount: totalAmount,
                    reference,
                    provider,
                    status: 'pending',
                    metadata: { user_id: userId, amount, fee },
                })
                .select()
                .single()

            if (paymentError || !payment) {
                console.error('[WalletInit] wallet_payments insert error:', paymentError?.message, paymentError?.code)
                return NextResponse.json(
                    { error: `Failed to create payment record: ${paymentError?.message || 'unknown error'}` },
                    { status: 500 }
                )
            }
            paymentId = (payment as any).id
        }

        // ── Step 10a: PAYSTACK ────────────────────────────────────────────────
        if (provider === 'paystack') {
            const userEmail = (user as any)?.email
            if (!userEmail) {
                console.error('[WalletInit] No email for userId:', userId)
                return NextResponse.json(
                    { error: 'Account email is required for Paystack. Please update your profile.' },
                    { status: 400 }
                )
            }

            let paystackData: any
            try {
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
                        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?reference=${reference}`,
                        metadata: { user_id: userId, amount, fee, type: 'wallet_topup' },
                    }),
                })
                paystackData = await paystackRes.json()
                console.log('[WalletInit] Paystack HTTP:', paystackRes.status, '| status:', paystackData.status, '| message:', paystackData.message)
            } catch (fetchErr: any) {
                console.error('[WalletInit] Paystack fetch error:', fetchErr.message)
                await (supabaseAdmin.from('wallet_payments' as any)).update({ status: 'failed' }).eq('id', paymentId)
                return NextResponse.json({ error: 'Could not reach Paystack. Please try again.' }, { status: 502 })
            }

            if (!paystackData.status || !paystackData.data?.authorization_url) {
                await (supabaseAdmin.from('wallet_payments' as any)).update({ status: 'failed' }).eq('id', paymentId)
                return NextResponse.json(
                    { error: paystackData.message || 'Paystack rejected the request. Please try again.' },
                    { status: 500 }
                )
            }

            return NextResponse.json({
                success: true,
                gateway: 'paystack',
                authorization_url: paystackData.data.authorization_url,
                reference,
            })
        }

        // ── Step 10b: MOOLRE ──────────────────────────────────────────────────
        const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[network]
        let moolreResponse = await initiatePayment({
            amount: totalAmount,
            payerPhone: phone,
            channel: channelId,
            externalRef: reference,
            otpCode,
        })

        if (moolreResponse.success && String(moolreResponse.status) === '1' && otpCode) {
            moolreResponse = await initiatePayment({ amount: totalAmount, payerPhone: phone, channel: channelId, externalRef: reference })
        }

        if (!moolreResponse.success) {
            console.error('[WalletInit] Moolre error:', moolreResponse.error)
            if (!existingRef) {
                await (supabaseAdmin.from('wallet_payments' as any)).update({ status: 'failed' }).eq('id', paymentId)
            }
            return NextResponse.json({ error: moolreResponse.error || 'Failed to initialize payment' }, { status: 500 })
        }

        if (moolreResponse.status === '200_OTP_REQ') {
            return NextResponse.json({
                success: true, gateway: 'moolre', otpRequired: true, reference,
                message: 'OTP is required to complete this payment. Please enter the code sent to your phone.',
            })
        }

        return NextResponse.json({
            success: true, gateway: 'moolre', reference,
            message: 'Payment prompt sent to your phone. Please approve to complete top-up.',
        })

    } catch (error: any) {
        console.error('[WalletInit] Unhandled exception at step:', error?.message, error?.stack?.split('\n')[1])
        return NextResponse.json({ error: `Server error: ${error?.message || 'unknown'}` }, { status: 500 })
    }
}
