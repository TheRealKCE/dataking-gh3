import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processCompletedWalletPayment } from '@/lib/payments'

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
            const { reference } = event.data

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
