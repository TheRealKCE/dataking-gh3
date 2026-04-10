import { createServerClient } from './supabase'
import { sendWalletTopupSuccessEmail, sendPermanentAgentUpgradeSuccessEmail } from './email-service'
import { sendWalletTopupSuccessSMS, sendAgentUpgradeSuccessSMS, sendAgentExtensionSuccessSMS, sendPermanentAgentUpgradeSuccessSMS } from './sms-service'

/**
 * Processes a completed payment by updating the status, 
 * crediting the wallet, logging the transaction, and notifying the user.
 * This is designed to be idempotent.
 */
export async function processCompletedWalletPayment(reference: string, providerMetadata?: any) {
    const supabase = createServerClient()

    // 1. Get payment record
    const { data: paymentData, error: paymentError } = await supabase
        .from('wallet_payments')
        .select('*')
        .eq('reference', reference)
        .single()

    const payment = paymentData as any

    if (paymentError || !payment) {
        console.error('[PaymentProcess] Payment not found:', reference)
        return { success: false, error: 'Payment not found' }
    }

    // 2. Atomic Update (Idempotency Check)
    // We attempt to update the status to 'completed' ONLY if it is currently 'pending'.
    // If the record exists but status is not 'pending', this will return 0 rows
    // (or empty data), meaning it was already processed.
    const { data: updatedPayment, error: updatePaymentError } = await (supabase
        .from('wallet_payments') as any)
        .update({
            status: 'completed',
            metadata: providerMetadata || payment.metadata,
            updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .eq('status', 'pending')
        .select()
        .single()

    if (updatePaymentError) {
        // If error is just "no rows returned", it means condition failed (already completed)
        // But .single() might throw if 0 rows. Use MaybeSingle if available or handle error code.
        // Actually, Supabase .single() returns error code PGRST116 for no rows.
        if (updatePaymentError.code === 'PGRST116') {
            return { success: true, alreadyProcessed: true }
        }
        console.error('[PaymentProcess] Update payment error:', updatePaymentError)
        return { success: false, error: 'Failed to update payment status' }
    }

    if (!updatedPayment) {
        // Fallback if no error was thrown but no data returned (dependent on client version)
        return { success: true, alreadyProcessed: true }
    }

    // 4. Credit wallet
    const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', payment.wallet_id)
        .single()

    const wallet = walletData as any

    if (walletError || !wallet) {
        console.error('[PaymentProcess] Wallet not found:', payment.wallet_id)
        return { success: false, error: 'Wallet not found' }
    }

    const { error: updateWalletError } = await (supabase
        .from('wallets') as any)
        .update({
            balance: wallet.balance + payment.amount,
            total_credited: (wallet.total_credited || 0) + payment.amount,
            updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)

    if (updateWalletError) {
        console.error('[PaymentProcess] Update wallet error:', updateWalletError)
        return { success: false, error: 'Failed to credit wallet' }
    }

    // 5. Create transaction record
    const { error: txnError } = await (supabase.from('wallet_transactions') as any).insert({
        wallet_id: payment.wallet_id,
        user_id: payment.user_id,
        type: 'credit',
        amount: payment.amount,
        description: 'Wallet top-up via Paystack',
        reference: reference,
        source: 'payment',
        status: 'completed',
    })

    if (txnError) {
        console.error('[PaymentProcess] Transaction log error:', txnError)
    }

    // 6. Create notification
    const { error: notifyError } = await (supabase.from('notifications') as any).insert({
        user_id: payment.user_id,
        title: 'Wallet Topped Up',
        message: `Your wallet has been credited with GHS ${payment.amount.toFixed(2)}`,
        type: 'payment_success',
        action_url: '/dashboard/wallet',
    })

    if (notifyError) {
        console.error('[PaymentProcess] Notification error:', notifyError)
    }

    // 7. Send email notification
    try {
        // Get user details for email
        const { data: userData } = await supabase
            .from('users')
            .select('email, first_name, phone_number')
            .eq('id', payment.user_id)
            .single()

        if (userData) {
            const newBalance = wallet.balance + payment.amount
            await sendWalletTopupSuccessEmail(
                (userData as any).email,
                (userData as any).first_name || 'Customer',
                payment.amount,
                reference,
                newBalance
            )

            // Send SMS notification
            if ((userData as any).phone_number) {
                console.log('[PaymentProcess] Found user phone:', (userData as any).phone_number)
                await sendWalletTopupSuccessSMS(
                    (userData as any).phone_number,
                    {
                        amount: payment.amount,
                        newBalance
                    }
                ).then(res => console.log('[PaymentProcess] SMS Result:', res))
                    .catch(err => console.error('[PaymentProcess] SMS error:', err))
            } else {
                console.warn('[PaymentProcess] No phone number found for user:', payment.user_id)
            }

        }
    } catch (emailError) {
        // Don't fail the payment process if email fails
        console.error('[PaymentProcess] Email notification error:', emailError)
    }

    return { success: true }
}

/**
 * Processes a completed upgrade payment by updating the user's role 
 * and extending their agent membership duration.
 */
export async function processCompletedUpgradePayment(reference: string, providerMetadata: any) {
    const supabase = createServerClient()

    // 1. Get payment record
    const { data: paymentData, error: paymentError } = await supabase
        .from('wallet_payments')
        .select('*')
        .eq('reference', reference)
        .single()

    const payment = paymentData as any

    if (paymentError || !payment) {
        console.error('[UpgradeProcess] Payment not found:', reference)
        return { success: false, error: 'Payment not found' }
    }

    // 2. Atomic Update (Idempotency Check)
    const { data: updatedPayment, error: updatePaymentError } = await (supabase
        .from('wallet_payments') as any)
        .update({
            status: 'completed',
            metadata: providerMetadata,
            updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .eq('status', 'pending')
        .select()
        .single()

    if (updatePaymentError) {
        if (updatePaymentError.code === 'PGRST116') {
            return { success: true, alreadyProcessed: true }
        }
        console.error('[UpgradeProcess] Update payment error:', updatePaymentError)
        return { success: false, error: 'Failed to update payment status' }
    }

    if (!updatedPayment) return { success: true, alreadyProcessed: true }

    // 3. Get User and current expiry
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, agent_expires_at, email, first_name, phone_number')
        .eq('id', payment.user_id)
        .single()

    const user = userData as any

    if (userError || !user) {
        console.error('[UpgradeProcess] User not found:', payment.user_id)
        return { success: false, error: 'User not found' }
    }

    // 4. Calculate new expiry
    const isPermanent = (payment.metadata as any)?.plan_type === 'permanent';
    const planDays = (payment.metadata as any)?.plan_days || 30
    const now = new Date()
    let currentExpiry = user.agent_expires_at ? new Date(user.agent_expires_at) : null
    let newExpiry: Date | null = null;

    if (!isPermanent) {
        if (currentExpiry && currentExpiry > now) {
            // Extend existing
            newExpiry = new Date(currentExpiry.getTime() + (planDays * 24 * 60 * 60 * 1000))
        } else {
            // Start fresh
            newExpiry = new Date(now.getTime() + (planDays * 24 * 60 * 60 * 1000))
        }
    }

    // 5. Update user role and expiry
    const { error: updateUserError } = await (supabase
        .from('users') as any)
        .update({
            role: 'agent',
            agent_expires_at: isPermanent ? null : newExpiry?.toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', payment.user_id)

    if (updateUserError) {
        console.error('[UpgradeProcess] Update user error:', updateUserError)
        return { success: false, error: 'Failed to update user role' }
    }

    // 6. Create notification
    await (supabase.from('notifications') as any).insert({
        user_id: payment.user_id,
        title: isPermanent ? 'Permanent Agent Unlocked! 💎' : 'Upgrade Successful',
        message: isPermanent 
            ? 'Congratulations! You now have lifetime access to premium agent benefits.' 
            : `Congratulations! Your Agent membership has been ${currentExpiry && currentExpiry > now ? 'extended' : 'activated'} until ${newExpiry?.toLocaleDateString()}.`,
        type: 'system',
        action_url: '/dashboard',
    })

    // 7. Send SMS notification
    try {
        if (user.phone_number) {
            if (isPermanent) {
                // Send Permanent/Lifetime notification (static import at top-level)
                await sendPermanentAgentUpgradeSuccessSMS(user.phone_number)
            } else if (newExpiry) {
                const planLabelText = (payment.metadata as any)?.plan_label ||
                    (planDays === 3 ? '3 Days' : planDays === 14 ? '14 Days' : '30 Days')

                // Calculate remaining days from now
                const diffMs = newExpiry.getTime() - now.getTime()
                const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

                // Check if it was an extension (user was already agent and didn't expire)
                if (currentExpiry && currentExpiry > now) {
                    // Extension
                    await sendAgentExtensionSuccessSMS(
                        user.phone_number,
                        newExpiry
                    )
                } else {
                    // New Upgrade
                    await sendAgentUpgradeSuccessSMS(
                        user.phone_number,
                        user.first_name || 'Agent',
                        planLabelText,
                        remainingDays,
                        newExpiry.toISOString() // Pass the expiry date
                    )
                }
            }
        }
    } catch (smsError) {
        console.error('[UpgradeProcess] SMS error:', smsError)
        // Don't fail the transaction if SMS fails
    }

    // 8. Send permanent agent upgrade email notification
    // Migrated from /api/payments/webhook (old route) — lines 140-147
    if (isPermanent && user.email) {
        try {
            await sendPermanentAgentUpgradeSuccessEmail(
                user.email,
                user.first_name || 'User'
            )
        } catch (emailError) {
            console.error('[UpgradeProcess] Permanent upgrade email error:', emailError)
            // Don't fail the transaction if email fails
        }
    }

    return { success: true }
}
