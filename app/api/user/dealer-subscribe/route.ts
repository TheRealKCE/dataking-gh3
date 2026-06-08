import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { generateReferenceCode } from '@/lib/utils'
import { initiatePayment, checkPaymentStatus, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { phone, network, otpCode, reference: existingRef, planType: rawPlanType } = await request.json().catch(() => ({}))

        const planType: 'dealer_3m' | 'dealer_6m' = rawPlanType === 'dealer_3m' ? 'dealer_3m' : 'dealer_6m'
        const planDays = planType === 'dealer_3m' ? 90 : 180
        const planLabel = planType === 'dealer_3m' ? '3 Months Dealer Subscription' : '6 Months Dealer Subscription'

        const { data: dbUser } = await supabase
            .from('users')
            .select('role, dealer_expires_at')
            .eq('id', authUser.id)
            .single()

        if (!dbUser || !['customer', 'dealer', 'agent'].includes((dbUser as any).role)) {
            return NextResponse.json({ error: 'Only customers, agents, and dealers can subscribe to the dealership plan' }, { status: 400 })
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: settings } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', ['dealer_subscription_price_6m', 'dealer_subscription_price_3m', 'active_payment_provider_web'])

        const settingsMap: Record<string, string> = {}
        for (const row of (settings || [])) settingsMap[row.key] = row.value

        const provider = settingsMap.active_payment_provider_web === 'paystack' ? 'paystack' : 'moolre'
        const priceKey = planType === 'dealer_3m' ? 'dealer_subscription_price_3m' : 'dealer_subscription_price_6m'
        const subscriptionPrice = parseFloat(settingsMap[priceKey] || '0')

        if (!subscriptionPrice || subscriptionPrice <= 0) {
            return NextResponse.json({ error: 'Dealer subscription price not configured' }, { status: 400 })
        }

        if (provider === 'moolre') {
            const channelId = phone && MOOLRE_PAYMENT_CHANNEL_MAP[network]
            if (!phone || !network || !channelId) {
                return NextResponse.json({ error: 'Phone number and network are required' }, { status: 400 })
            }
        }

        const reference = existingRef || `dealer_sub_${generateReferenceCode()}`

        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', authUser.id)
            .single()

        if (!wallet) throw new Error('User wallet not found')

        if (!existingRef) {
            const { error: paymentError } = await (supabaseAdmin.from('wallet_payments') as any)
                .insert({
                    user_id: authUser.id,
                    wallet_id: (wallet as any).id,
                    amount: subscriptionPrice,
                    fee: 0,
                    total_amount: subscriptionPrice,
                    reference,
                    provider,
                    status: 'pending',
                    metadata: {
                        user_id: authUser.id,
                        upgrade_type: 'dealer_subscription',
                        plan_type: planType,
                        plan_days: planDays,
                        plan_label: planLabel,
                        base_amount: subscriptionPrice,
                        fee: 0,
                    },
                })

            if (paymentError) {
                console.error('[DealerSubscribe] Insert payment error:', paymentError)
                throw new Error('Failed to record payment attempt')
            }
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
                    amount: Math.round(subscriptionPrice * 100),
                    reference,
                    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?reference=${reference}`,
                    metadata: {
                        upgrade_type: 'dealer_subscription',
                        plan_type: 'dealer_6m',
                        plan_days: 180,
                        plan_label: '6 Months Dealer Subscription',
                    },
                }),
            })

            const paystackData = await paystackRes.json()

            if (!paystackData.status) {
                console.error('[DealerSubscribe] Paystack init failed:', paystackData)
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

        const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[network]

        let moolreResponse = await initiatePayment({
            amount: subscriptionPrice,
            payerPhone: phone,
            channel: channelId,
            externalRef: reference,
            otpCode,
        })

        if (moolreResponse.success && String(moolreResponse.status) === '1' && otpCode) {
            moolreResponse = await initiatePayment({
                amount: subscriptionPrice,
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
        console.error('[DealerSubscribe] Exception:', error)
        return NextResponse.json({ error: error.message || 'Failed to initialize payment' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const reference = searchParams.get('reference') || searchParams.get('trxref')

        if (!reference) {
            return NextResponse.json({ success: false, error: 'No reference provided' }, { status: 400 })
        }

        if (!reference.startsWith('dealer_sub_')) {
            return NextResponse.json({ success: false, error: 'Not a dealer subscription reference' }, { status: 400 })
        }

        const moolreResponse = await checkPaymentStatus(reference)

        if (!moolreResponse.success || moolreResponse.txstatus === null) {
            return NextResponse.json({ success: true, status: 'pending' })
        }

        if (moolreResponse.txstatus === 0 || moolreResponse.txstatus === 3) {
            return NextResponse.json({ success: true, status: 'pending' })
        }

        if (moolreResponse.txstatus === 2) {
            return NextResponse.json({ success: false, status: 'failed' })
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: payment } = await supabaseAdmin
            .from('wallet_payments')
            .select('id, status, user_id')
            .eq('reference', reference)
            .single()

        if (!payment) {
            return NextResponse.json({ success: false, status: 'failed', error: 'Payment record not found' }, { status: 400 })
        }

        if ((payment as any).status === 'completed') {
            return NextResponse.json({ success: true, status: 'completed', alreadyProcessed: true })
        }

        if ((payment as any).user_id !== authUser.id) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        }

        // Mark payment completed
        await (supabaseAdmin.from('wallet_payments') as any)
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', (payment as any).id)
            .eq('status', 'pending')

        // Extend dealer_expires_at by plan_days from payment metadata (90 or 180)
        const planDays: number = (payment as any)?.metadata?.plan_days ?? 180

        const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('dealer_expires_at, dealer_claimed_at, role')
            .eq('id', authUser.id)
            .single()

        const currentExpiry = (userRow as any)?.dealer_expires_at
            ? new Date((userRow as any).dealer_expires_at)
            : new Date()

        if (currentExpiry < new Date()) {
            currentExpiry.setTime(new Date().getTime())
        }

        const newExpiry = new Date(currentExpiry)
        newExpiry.setDate(newExpiry.getDate() + planDays)

        const now = new Date().toISOString()
        await (supabaseAdmin.from('users') as any)
            .update({
                role: 'dealer',
                dealer_expires_at: newExpiry.toISOString(),
                dealer_claimed_at: (userRow as any)?.dealer_claimed_at ?? now,
                updated_at: now,
            })
            .eq('id', authUser.id)

        return NextResponse.json({ success: true, status: 'completed' })
    } catch (error: any) {
        console.error('[DealerSubscribeVerify] Exception:', error)
        return NextResponse.json({ success: false, error: error.message || 'Verification failed' }, { status: 500 })
    }
}
