import { createServerClient } from './supabase'
import { sendWalletTopupSuccessEmail } from './email-service'
import { sendWalletTopupSuccessSMS } from './sms-service'

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
                await sendWalletTopupSuccessSMS(
                    (userData as any).phone_number,
                    {
                        amount: payment.amount,
                        newBalance
                    }
                ).catch(err => console.error('[PaymentProcess] SMS error:', err))
            }

        }
    } catch (emailError) {
        // Don't fail the payment process if email fails
        console.error('[PaymentProcess] Email notification error:', emailError)
    }

    return { success: true }
}
