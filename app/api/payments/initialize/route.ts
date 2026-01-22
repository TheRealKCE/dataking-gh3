import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient, createServerClient } from '@/lib/supabase'
import { calculatePaystackFee, generateReferenceCode } from '@/lib/utils'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!
const PAYSTACK_FEE_PERCENT = 1.95

export async function POST(request: NextRequest) {
    try {
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
        const { data: user } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single()

        // Get or create wallet
        let { data: wallet } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', userId)
            .single()

        if (!wallet) {
            const { data: newWallet } = await (supabase
                .from('wallets') as any)
                .insert({ user_id: userId })
                .select()
                .single()
            wallet = newWallet
        }

        const fee = calculatePaystackFee(amount, PAYSTACK_FEE_PERCENT)
        const totalAmount = amount + fee
        const reference = `WAL-${generateReferenceCode()}`

        // Create payment record
        const { data: payment, error: paymentError } = await (supabase
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
            await (supabase
                .from('wallet_payments') as any)
                .update({ status: 'failed' })
                .eq('id', (payment as any).id)
            return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 })
        }

        // Update payment with Paystack reference
        await (supabase
            .from('wallet_payments') as any)
            .update({ provider_reference: paystackData.data.reference })
            .eq('id', (payment as any).id)

        return NextResponse.json({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            reference: reference,
        })
    } catch (error) {
        console.error('Payment initialization error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
