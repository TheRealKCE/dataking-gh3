import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createServerClient } from '@/lib/supabase'
import { sendAgentUpgradeSuccessSMS, sendAgentExtensionSuccessSMS } from '@/lib/sms-service'

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
            const { reference, amount: paidAmountKobo, metadata } = event.data

            // Initialize Supabase client
            const supabase = createServerClient()

            // Check if this is an agent upgrade payment
            if (metadata?.upgrade_type === 'agent') {
                // === SECURITY: Verify amount against database, NOT metadata ===
                // Fetch the expected upgrade price from admin_settings
                const { data: priceSettings } = await supabase
                    .from('admin_settings')
                    .select('key, value')
                    .in('key', ['agent_upgrade_prices'])

                let expectedPrice = 0
                if (priceSettings?.length) {
                    try {
                        const prices = typeof (priceSettings[0] as any).value === 'string'
                            ? JSON.parse((priceSettings[0] as any).value)
                            : (priceSettings[0] as any).value
                        const planKey = metadata.plan_type || '30d'
                        expectedPrice = prices[planKey] || 0
                    } catch { /* fallback below */ }
                }

                // Fallback: if DB price not configured, trust metadata (backward compat)
                if (expectedPrice <= 0) {
                    expectedPrice = (metadata.base_amount || 0) + (metadata.fee || 0)
                }

                const expectedAmountKobo = Math.round(expectedPrice * 100)

                if (paidAmountKobo !== expectedAmountKobo) {
                    console.error(`Webhook: AMOUNT MISMATCH for agent upgrade ${reference}. Expected: ${expectedAmountKobo}, Paid: ${paidAmountKobo}`)
                    return NextResponse.json({ received: true }, { status: 200 })
                }

                // Fetch user details for SMS and extension logic
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('first_name, phone_number, role, agent_expires_at')
                    .eq('id', metadata.user_id)
                    .single()

                if (userError || !userData) {
                    console.error('Failed to fetch user details for agent upgrade:', userError)
                    return NextResponse.json({ received: true }, { status: 200 })
                }

                const user = userData as any

                // Calculate base plan days
                const planDaysCount = metadata.plan_days || (metadata.plan_type === '3d' ? 3 : metadata.plan_type === '14d' ? 14 : 30)

                // Calculate expiration date
                let expirationDate = new Date()

                // Extension logic: If already an agent and not expired, start from current expiry
                if (user.role === 'agent' && user.agent_expires_at) {
                    const currentExpiry = new Date(user.agent_expires_at)
                    if (currentExpiry > new Date()) {
                        expirationDate = currentExpiry
                    }
                }

                expirationDate.setDate(expirationDate.getDate() + planDaysCount)

                // Update user role to agent and set expiration
                const { error: updateError } = await (supabase as any)
                    .from('users')
                    .update({
                        role: 'agent',
                        agent_expires_at: expirationDate.toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', metadata.user_id)

                if (updateError) {
                    console.error('Failed to upgrade user to agent:', updateError)
                    return NextResponse.json({ received: true }, { status: 200 })
                }

                // Calculate total remaining days for SMS
                const now = new Date()
                const diffMs = expirationDate.getTime() - now.getTime()
                const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

                // Send SMS notification
                if (user.phone_number) {
                    const planLabelText = metadata.plan_type === '3d' ? '3days' : metadata.plan_type === '14d' ? '14days' : '30days'

                    // Check if it was an extension (based on logic above, expirationDate was calculated from currentExpiry if valid)
                    const wasExtension = user.role === 'agent' && user.agent_expires_at && new Date(user.agent_expires_at) > new Date()

                    if (wasExtension) {
                        await sendAgentExtensionSuccessSMS(
                            user.phone_number,
                            expirationDate
                        )
                    } else {
                        await sendAgentUpgradeSuccessSMS(
                            user.phone_number,
                            user.first_name || 'User',
                            planLabelText,
                            remainingDays,
                            expirationDate.toISOString() // Pass expiry date
                        )
                    }
                }

                // Create notification
                await (supabase as any)
                    .from('notifications')
                    .insert({
                        user_id: metadata.user_id,
                        title: 'Upgrade Successful! 👑',
                        message: `Congratulations! Your Agent status is now valid for ${remainingDays} days.`,
                        type: 'system',
                    })

                console.log(`Successfully upgraded user ${metadata.user_id} to agent. Remaining days: ${remainingDays}`)
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // Regular wallet payment processing
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
