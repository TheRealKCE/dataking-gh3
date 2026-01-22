import { createServerClient } from './supabase'

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

    // 2. Check if already processed (Idempotency)
    if (payment.status === 'completed') {
        return { success: true, alreadyProcessed: true }
    }

    // 3. Update payment status
    const { error: updatePaymentError } = await (supabase
        .from('wallet_payments') as any)
        .update({
            status: 'completed',
            metadata: providerMetadata || payment.metadata,
            updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)

    if (updatePaymentError) {
        console.error('[PaymentProcess] Update payment error:', updatePaymentError)
        return { success: false, error: 'Failed to update payment status' }
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

    return { success: true }
}
