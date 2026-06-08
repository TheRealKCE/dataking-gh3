import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateReferenceCode } from '@/lib/utils'
import { initiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { plan = '30d', phone, network, otpCode, reference: existingRef } = await request.json().catch(() => ({}));

        const { data: dbUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (dbUser?.role !== 'customer' && dbUser?.role !== 'agent') {
            return NextResponse.json(
                { error: 'Membership upgrades are only available for customers and existing agents' },
                { status: 400 }
            )
        }

        const { createClient } = await import('@supabase/supabase-js')
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: settings } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', [
                'agent_upgrade_price_3d',
                'agent_upgrade_price_14d',
                'agent_upgrade_price_30d',
                'agent_upgrade_price_permanent',
                'active_payment_provider_web',
            ])

        const settingsMap: Record<string, any> = {}
        for (const row of (settings || [])) settingsMap[row.key] = row.value

        const provider = String(settingsMap.active_payment_provider_web || 'moolre') === 'paystack' ? 'paystack' : 'moolre'

        // For Moolre: phone + network are required
        if (provider === 'moolre') {
            const channelId = phone && MOOLRE_PAYMENT_CHANNEL_MAP[network]
            if (!phone || !network || !channelId) {
                return NextResponse.json({ error: 'Phone number and network are required' }, { status: 400 })
            }
        }

        const getPrice = (key: string, def: number) => {
            const val = settingsMap[key]
            return val !== undefined ? Number(val) : def
        }

        let upgradePrice = 100
        let planLabel = 'Agent Status'

        if (plan === '3d') {
            upgradePrice = getPrice('agent_upgrade_price_3d', 9.99)
            planLabel = '3 Days Agent Pass'
        } else if (plan === '14d') {
            upgradePrice = getPrice('agent_upgrade_price_14d', 49.99)
            planLabel = '14 Days Agent Pass'
        } else if (plan === 'permanent') {
            upgradePrice = getPrice('agent_upgrade_price_permanent', 149.99)
            planLabel = 'Permanent Agent Pass'
        } else {
            upgradePrice = getPrice('agent_upgrade_price_30d', 99.99)
            planLabel = '30 Days Agent Pass'
        }

        const totalAmount = upgradePrice
        const reference = existingRef || `agent_upgrade_${generateReferenceCode()}`
        const planDays = plan === 'permanent' ? null : (plan === '3d' ? 3 : (plan === '14d' ? 14 : 30))

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
                amount: upgradePrice,
                fee: 0,
                total_amount: upgradePrice,
                reference,
                provider,
                status: 'pending',
                metadata: {
                    user_id: authUser.id,
                    upgrade_type: 'agent',
                    plan_type: plan,
                    plan_days: planDays,
                    plan_label: planLabel,
                    base_amount: upgradePrice,
                    fee: 0,
                },
            })

        if (!existingRef && paymentError) {
            console.error('[UpgradeInit] Database error:', paymentError)
            throw new Error('Failed to record payment attempt')
        }

        // ── PAYSTACK BRANCH ──────────────────────────────────────────────────────
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
                    amount: Math.round(upgradePrice * 100), // kobo
                    reference,
                    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?reference=${reference}`,
                    metadata: {
                        upgrade_type: 'agent',
                        plan_type: plan,
                        plan_days: planDays,
                        plan_label: planLabel,
                    },
                }),
            })

            const paystackData = await paystackRes.json()

            if (!paystackData.status) {
                console.error('[UpgradeInit] Paystack init failed:', paystackData)
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
            console.log('[UpgradeInit] OTP verified successfully. Sending follow-up payment request.')
            moolreResponse = await initiatePayment({
                amount: totalAmount,
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
        console.error('Error initializing agent upgrade:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to initialize upgrade' },
            { status: 500 }
        )
    }
}
