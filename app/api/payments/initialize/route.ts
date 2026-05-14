import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { calculatePaystackFee, generateReferenceCode } from '@/lib/utils'
import { initiatePayment, MOOLRE_PAYMENT_CHANNEL_MAP } from '@/lib/moolre-payment-service'


export async function POST(request: NextRequest) {
    try {
        // Check if payment system is under maintenance
        if (process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true') {
            return NextResponse.json(
                { error: 'Payment system is currently under maintenance. Please try again later.' },
                { status: 503 }
            )
        }

        const supabase = createRouteClient()
        const supabaseAdmin = createServerClient() // For database operations
        const { amount, phone, network, otpCode, reference: existingRef } = await request.json()

        const MAX_TOPUP_AMOUNT = Number(process.env.MAX_WALLET_TOPUP_AMOUNT) || 10000
        if (!amount || typeof amount !== 'number' || amount < 5 || amount > MAX_TOPUP_AMOUNT) {
            return NextResponse.json({ error: `Amount must be between GHS 5 and GHS ${MAX_TOPUP_AMOUNT.toLocaleString()}` }, { status: 400 })
        }

        if (!phone || !network || !MOOLRE_PAYMENT_CHANNEL_MAP[network]) {
            return NextResponse.json({ error: 'Valid phone number and network are required' }, { status: 400 })
        }

        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id

        // Get user details
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('id', userId)
            .single()

        // Get or create wallet
        let { data: wallet } = await (supabaseAdmin
            .from('wallets') as any)
            .select('id')
            .eq('user_id', userId)
            .single()

        if (!wallet) {
            const { data: newWallet } = await (supabaseAdmin
                .from('wallets') as any)
                .insert({ user_id: userId })
                .select()
                .single()
            wallet = newWallet
        }

        // Get Paystack fee setting
        const { data: feeData } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', ['paystack_fee_percent', 'agent_paystack_fee_percent'])

        // Determine which fee to use
        let feeKey = 'paystack_fee_percent'

        // Check if user is agent
        const { data: userRoleData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', userId)
            .single()

        if ((userRoleData as any)?.role === 'agent') {
            feeKey = 'agent_paystack_fee_percent'
        }

        const feeSetting = feeData?.find((s: any) => s.key === feeKey) ||
            feeData?.find((s: any) => s.key === 'paystack_fee_percent')

        // Parse fee percent (handle string/number difference in JSONB)
        let feePercent = 1.95 // Default fallback
        if ((feeSetting as any)?.value) {
            // value is JSONB, could be string "1.95" or number 1.95
            const val = (feeSetting as any).value
            const parsed = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : 1.95)
            if (!isNaN(parsed)) feePercent = parsed
        }

        const fee = calculatePaystackFee(amount, feePercent)
        const totalAmount = amount + fee
        let reference = existingRef || `WAL-${generateReferenceCode()}`
        let paymentId: string | null = null

        if (existingRef) {
            const { data: existingPayment } = await (supabaseAdmin
                .from('wallet_payments') as any)
                .select('id')
                .eq('reference', existingRef)
                .single()
            if (existingPayment) paymentId = (existingPayment as any).id
        }

        if (!paymentId) {
            // Create payment record
            const { data: payment, error: paymentError } = await (supabaseAdmin
                .from('wallet_payments') as any)
                .insert({
                    user_id: userId,
                    wallet_id: (wallet as any)!.id,
                    amount: amount,
                    fee: fee,
                    total_amount: totalAmount,
                    reference: reference,
                    provider: 'moolre',
                    status: 'pending',
                    metadata: {
                        user_id: userId,
                        amount: amount,
                        fee: fee,
                    }
                })
                .select()
                .single()

            if (paymentError) {
                console.error('Payment record error:', paymentError)
                return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
            }
            paymentId = (payment as any).id
        }

        // Initialize Moolre payment
        const channelId = MOOLRE_PAYMENT_CHANNEL_MAP[network]
        
        const moolreResponse = await initiatePayment({
            amount: totalAmount,
            payerPhone: phone,
            channel: channelId,
            externalRef: reference,
            otpCode: otpCode
        })

        if (!moolreResponse.success) {
            console.error('Moolre error:', moolreResponse.error)
            if (!existingRef) {
                await (supabaseAdmin
                    .from('wallet_payments') as any)
                    .update({ status: 'failed' })
                    .eq('id', paymentId)
            }
            return NextResponse.json({ error: moolreResponse.error || 'Failed to initialize payment' }, { status: 500 })
        }

        if (moolreResponse.status === '200_OTP_REQ') {
            return NextResponse.json({
                success: true,
                otpRequired: true,
                reference: reference,
                message: 'OTP is required to complete this payment. Please enter the code sent to your phone.'
            })
        }

        return NextResponse.json({
            success: true,
            reference: reference,
            message: 'Payment prompt sent to your phone. Please approve to complete top-up.'
        })
    } catch (error) {
        console.error('Payment initialization error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
