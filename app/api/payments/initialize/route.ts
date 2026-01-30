import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { calculatePaystackFee, generateReferenceCode } from '@/lib/utils'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!


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
        const { amount } = await request.json()

        if (!amount || amount < 5) {
            return NextResponse.json({ error: 'Minimum amount is GHS 5' }, { status: 400 })
        }

        // Get current user
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

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
        const reference = `WAL-${generateReferenceCode()}`

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
                provider: 'paystack',
                status: 'pending',
            })
            .select()
            .single()

        if (paymentError) {
            console.error('Payment record error:', paymentError)
            return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
        }

        // Initialize Paystack payment
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: (user as any)?.email || session.user.email,
                amount: Math.round(totalAmount * 100), // Paystack uses kobo/pesewas
                currency: 'GHS',
                reference: reference,
                callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/verify?reference=${reference}`,
                metadata: {
                    user_id: userId,
                    payment_id: payment.id,
                    amount: amount,
                    fee: fee,
                },
            }),
        })

        const paystackData = await paystackResponse.json()

        if (!paystackData.status) {
            console.error('Paystack error:', paystackData)
            await (supabaseAdmin
                .from('wallet_payments') as any)
                .update({ status: 'failed' })
                .eq('id', (payment as any).id)
            return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 })
        }

        // Update payment with Paystack reference
        await (supabaseAdmin
            .from('wallet_payments') as any)
            .update({ provider_reference: paystackData.data.reference })
            .eq('id', (payment as any).id)

        return NextResponse.json({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            access_code: paystackData.data.access_code,
            reference: reference,
        })
    } catch (error) {
        console.error('Payment initialization error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
