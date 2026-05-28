import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { calculatePaystackFee, generateReferenceCode } from '@/lib/utils'
import { initiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'


export async function POST(request: NextRequest) {
    try {
        if (process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true') {
            return NextResponse.json(
                { error: 'Payment system is currently under maintenance. Please try again later.' },
                { status: 503 }
            )
        }

        const supabase = createRouteClient()
        const supabaseAdmin = createServerClient()
        const { amount, phone, network, otpCode, reference: existingRef } = await request.json()

        const MAX_TOPUP_AMOUNT = Number(process.env.MAX_WALLET_TOPUP_AMOUNT) || 10000
        if (!amount || typeof amount !== 'number' || amount < 5 || amount > MAX_TOPUP_AMOUNT) {
            return NextResponse.json({ error: `Amount must be between GHS 5 and GHS ${MAX_TOPUP_AMOUNT.toLocaleString()}` }, { status: 400 })
        }

        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id

        const [{ data: user }, { data: userRoleData }, { data: feeData }] = await Promise.all([
            supabaseAdmin.from('users').select('email').eq('id', userId).single(),
            supabaseAdmin.from('users').select('role').eq('id', userId).single(),
            supabaseAdmin.from('admin_settings').select('key, value').in('key', [
                'paystack_fee_percent',
                'agent_paystack_fee_percent',
                'active_payment_provider_web',
            ]),
        ])

        const settingsMap: Record<string, any> = {}
        for (const row of ((feeData as any[]) || [])) settingsMap[row.key] = row.value

        const provider = String(settingsMap.active_payment_provider_web || 'moolre') === 'paystack' ? 'paystack' : 'moolre'

        // For Moolre: phone + network are required
        if (provider === 'moolre' && (!phone || !network || !MOOLRE_PAYMENT_CHANNEL_MAP[network])) {
            return NextResponse.json({ error: 'Valid phone number and network are required' }, { status: 400 })
        }

        // Get or create wallet
        let { data: wallet } = await (supabaseAdmin.from('wallets') as any)
            .select('id')
            .eq('user_id', userId)
            .single()

        if (!wallet) {
            const { data: newWallet } = await (supabaseAdmin.from('wallets') as any)
                .insert({ user_id: userId })
                .select()
                .single()
            wallet = newWallet
        }

        const feeKey = (userRoleData as any)?.role === 'agent' ? 'agent_paystack_fee_percent' : 'paystack_fee_percent'
        const feeSetting = settingsMap[feeKey] ?? settingsMap['paystack_fee_percent']
        let feePercent = 1.95
        if (feeSetting !== undefined && feeSetting !== null) {
            const val = feeSetting
            const parsed = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : 1.95)
            if (!isNaN(parsed)) feePercent = parsed
        }

        const fee = calculatePaystackFee(amount, feePercent)
        const totalAmount = amount + fee
        const reference = existingRef || `WAL-${generateReferenceCode()}`
        let paymentId: string | null = null

        if (existingRef) {
            const { data: existingPayment } = await (supabaseAdmin.from('wallet_payments') as any)
                .select('id')
                .eq('reference', existingRef)
                .single()
            if (existingPayment) paymentId = (existingPayment as any).id
        }

        if (!paymentId) {
            const { data: payment, error: paymentError } = await (supabaseAdmin.from('wallet_payments') as any)
                .insert({
                    user_id: userId,
                    wallet_id: (wallet as any)!.id,
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

            if (paymentError) {
                console.error('[WalletInit] Payment record error:', paymentError)
                return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
            }
            paymentId = (payment as any).id
        }

        // ── PAYSTACK BRANCH ──────────────────────────────────────────────────────
        if (provider === 'paystack') {
            const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: (user as any)?.email,
                    amount: Math.round(totalAmount * 100), // kobo
                    reference,
                    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?reference=${reference}`,
                    metadata: { user_id: userId, amount, fee, type: 'wallet_topup' },
                }),
            })

            const paystackData = await paystackRes.json()

            if (!paystackData.status) {
                console.error('[WalletInit] Paystack init failed:', paystackData)
                await (supabaseAdmin.from('wallet_payments') as any).update({ status: 'failed' }).eq('id', paymentId)
                return NextResponse.json({ error: 'Payment gateway error' }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                gateway: 'paystack',
                authorization_url: paystackData.data.authorization_url,
                reference,
            })
        }

        // ── MOOLRE BRANCH ────────────────────────────────────────────────────────
        const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[network]

        let moolreResponse = await initiatePayment({
            amount: totalAmount,
            payerPhone: phone,
            channel: channelId,
            externalRef: reference,
            otpCode,
        })

        if (moolreResponse.success && String(moolreResponse.status) === '1' && otpCode) {
            console.log('[WalletInit] OTP verified successfully. Sending follow-up payment request.')
            moolreResponse = await initiatePayment({
                amount: totalAmount,
                payerPhone: phone,
                channel: channelId,
                externalRef: reference,
            })
        }

        if (!moolreResponse.success) {
            console.error('[WalletInit] Moolre error:', moolreResponse.error)
            if (!existingRef) {
                await (supabaseAdmin.from('wallet_payments') as any).update({ status: 'failed' }).eq('id', paymentId)
            }
            return NextResponse.json({ error: moolreResponse.error || 'Failed to initialize payment' }, { status: 500 })
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
            message: 'Payment prompt sent to your phone. Please approve to complete top-up.',
        })
    } catch (error) {
        console.error('Payment initialization error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
