import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.PAYSTACK_SECRET_KEY
        if (!secret) {
            console.error('PAYSTACK_SECRET_KEY is not defined')
            return NextResponse.json({ message: 'Server configuration error' }, { status: 500 })
        }

        // Get the raw body for signature verification
        const bodyValue = await request.text()

        // Verify signature
        const hash = crypto.createHmac('sha512', secret)
            .update(bodyValue)
            .digest('hex')

        const signature = request.headers.get('x-paystack-signature')

        if (hash !== signature) {
            return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
        }

        // Parse event
        const event = JSON.parse(bodyValue)

        // Handle charge.success
        if (event.event === 'charge.success') {
            const { reference, amount: paidAmountKobo } = event.data

            // Verify payment amount with database to prevent manipulation
            const supabase = createServerClient()

            const { data: payment } = await supabase
                .from('wallet_payments')
                .select('total_amount')
                .eq('reference', reference)
                .single()

            if (!payment) {
                console.error('Webhook: Payment reference not found:', reference)
                // Return 200 to acknowledge receipt but log error (prevent loop)
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // Paystack sends amount in kobo/pesewas. Database stores in GHS.
            const expectedAmountKobo = Math.round((payment as any).total_amount * 100)

            if (paidAmountKobo !== expectedAmountKobo) {
                console.error(`Webhook: AMOUNT MISMATCH for ref ${reference}. Expected: ${expectedAmountKobo}, Paid: ${paidAmountKobo}`)
                // Do NOT process payment. 
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // Process the payment safely (idempotency is handled inside this function)
            const result = await processCompletedWalletPayment(reference, event.data)

            if (!result.success && !result.alreadyProcessed) {
                console.error('Webhook processing failed for reference:', reference, result.error)
                // Return 500 to signal Paystack to retry if it's a genuine error
                // But generally 200 is safer to prevent infinite loops if it's a logic error
                // We'll return 200 but log the error
            }
        }

        return NextResponse.json({ received: true }, { status: 200 })

    } catch (error) {
        console.error('Webhook processing error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
