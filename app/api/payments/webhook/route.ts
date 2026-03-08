import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import {
    sendAgentUpgradeSuccessSMS,
    sendAgentExtensionSuccessSMS,
    sendPermanentAgentUpgradeSuccessSMS
} from '@/lib/sms-service'
import {
    sendWalletTopupSuccessEmail,
    sendWalletTopupFailedEmail,
    sendPermanentAgentUpgradeSuccessEmail
} from '@/lib/email-service'

export async function POST(request: NextRequest) {
    try {
        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!
        if (!PAYSTACK_SECRET_KEY) {
            console.error('PAYSTACK_SECRET_KEY is not defined')
            return NextResponse.json({ message: 'Server configuration error' }, { status: 500 })
        }

        // Get the raw body for signature verification
        const bodyValue = await request.text()

        // Verify signature
        const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
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
                // Verify amount against actual database price
                // Service role to bypass RLS
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                )

                const { data: settings } = await supabaseAdmin
                    .from('admin_settings')
                    .select('key, value')
                    .in('key', ['agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d', 'agent_upgrade_price_permanent'])

                const getPrice = (key: string, def: number) => {
                    const s = settings?.find((s: any) => s.key === key);
                    return s ? Number(s.value) : def;
                };

                let expectedPrice = 100;
                if (metadata.plan_type === '3d') {
                    expectedPrice = getPrice('agent_upgrade_price_3d', 9.99);
                } else if (metadata.plan_type === '14d') {
                    expectedPrice = getPrice('agent_upgrade_price_14d', 49.99);
                } else if (metadata.plan_type === 'permanent') {
                    expectedPrice = getPrice('agent_upgrade_price_permanent', 149.99);
                } else {
                    expectedPrice = getPrice('agent_upgrade_price_30d', 99.99);
                }

                const expectedAmountKobo = Math.round(expectedPrice * 100)

                if (paidAmountKobo !== expectedAmountKobo) {
                    console.error(`Webhook: AMOUNT MISMATCH for agent upgrade ${reference}. Expected: ${expectedAmountKobo}, Paid: ${paidAmountKobo}`)
                    return NextResponse.json({ received: true }, { status: 200 })
                }

                // Fetch user details for SMS and extension logic
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('first_name, phone_number, email, role, agent_expires_at')
                    .eq('id', metadata.user_id)
                    .single()

                if (userError || !userData) {
                    console.error('Failed to fetch user details for agent upgrade:', userError)
                    return NextResponse.json({ received: true }, { status: 200 })
                }

                const user = userData as any

                let expirationDateString = null;
                let remainingDays = 0;
                const isPermanent = metadata.plan_type === 'permanent';

                if (!isPermanent) {
                    const planDays = parseInt(metadata.plan_days) || (metadata.plan_type === '3d' ? 3 : metadata.plan_type === '14d' ? 14 : 30)
                    let expirationDate = new Date()

                    if (user.role === 'agent' && user.agent_expires_at) {
                        const currentExpiry = new Date(user.agent_expires_at)
                        if (currentExpiry > new Date()) {
                            expirationDate = currentExpiry
                        }
                    }

                    expirationDate.setDate(expirationDate.getDate() + planDays)
                    expirationDateString = expirationDate.toISOString()

                    const now = new Date()
                    const diffMs = expirationDate.getTime() - now.getTime()
                    remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
                }

                // Update user role to agent and set expiration
                const { error: updateError } = await (supabase as any)
                    .from('users')
                    .update({
                        role: 'agent',
                        agent_expires_at: isPermanent ? null : expirationDateString,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', metadata.user_id)

                if (updateError) {
                    console.error('Failed to upgrade user to agent:', updateError)
                    return NextResponse.json({ received: true }, { status: 200 })
                }

                // Send SMS/Email notifications
                if (isPermanent) {
                    // Send Permanent notifications
                    if (user.phone_number) {
                        await sendPermanentAgentUpgradeSuccessSMS(user.phone_number).catch(console.error)
                    }
                    if (user.email) {
                        await sendPermanentAgentUpgradeSuccessEmail(user.email, user.first_name || 'User').catch(console.error)
                    }
                } else {
                    if (user.phone_number) {
                        const planLabelText = metadata.plan_type === '3d' ? '3days' : metadata.plan_type === '14d' ? '14days' : '30days'
                        const wasExtension = user.role === 'agent' && user.agent_expires_at && new Date(user.agent_expires_at) > new Date()

                        if (wasExtension) {
                            await sendAgentExtensionSuccessSMS(
                                user.phone_number,
                                new Date(expirationDateString as string)
                            ).catch(console.error)
                        } else {
                            await sendAgentUpgradeSuccessSMS(
                                user.phone_number,
                                user.first_name || 'User',
                                planLabelText,
                                remainingDays,
                                expirationDateString as string
                            ).catch(console.error)
                        }
                    }
                }

                // Create notification
                await (supabase as any)
                    .from('notifications')
                    .insert({
                        user_id: metadata.user_id,
                        title: isPermanent ? 'Permanent Agent Unlocked! 💎' : 'Upgrade Successful! 👑',
                        message: isPermanent
                            ? 'Congratulations! You now have lifetime access to premium agent benefits.'
                            : `Congratulations! Your Agent status is now valid for ${remainingDays} days.`,
                        type: 'system',
                    })

                console.log(`Successfully upgraded user ${metadata.user_id} to agent. Permanent: ${isPermanent}`)
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
