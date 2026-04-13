import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'
import { z } from 'zod'
import { initiateTransfer, MOOLRE_CHANNEL_MAP } from '@/lib/moolre-transfer-service'
import { sendShopWithdrawalProcessedSMS } from '@/lib/sms-service'
import { sendShopWithdrawalProcessedEmail } from '@/lib/email-service'

const processSchema = z.object({
    transactionId: z.string().uuid('Invalid transaction ID'),
    action: z.enum(['moolre', 'manual']),
    adminNote: z.string().max(500).trim().optional(),
})

export async function POST(req: NextRequest) {
    try {
        // 1. Auth — must be an admin (verified server-side, not trusting client role)
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore as any })
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: dbUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'sub-admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // 2. Validate payload
        const body = await req.json()
        const parsed = processSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.errors.map(e => e.message) },
                { status: 400 }
            )
        }

        const { transactionId, action, adminNote } = parsed.data

        // 3. Use service client to bypass RLS for admin operations
        const db = createServerClient() as any

        // 4. Fetch the full transaction + shop details FIRST to populate SMS variables
        const { data: tx, error: txFetchError } = await db
            .from('shop_wallet_transactions')
            .select(`
                *,
                wallet:shop_wallets!inner(
                    id,
                    owner_id,
                    balance,
                    total_withdrawn
                )
            `)
            .eq('id', transactionId)
            .single()

        if (txFetchError || !tx) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
        }

        const { data: shopProfile } = await db
            .from('shop_profiles')
            .select('shop_name, owner_phone, owner_id')
            .eq('owner_id', tx.wallet.owner_id)
            .single()

        const { data: owner } = await db
            .from('users')
            .select('first_name, last_name, email')
            .eq('id', tx.wallet.owner_id)
            .single()

        const shopName = shopProfile?.shop_name || 'Unknown Shop'
        const ownerPhone = shopProfile?.owner_phone || ''
        const ownerEmail = owner?.email || ''
        const firstName = owner?.first_name || shopName
        
        // Handle separation of MoMo and Bank account numbers
        const paymentReceiverNumber = tx.momo_number || tx.account_number || ''

        // ─── ACTION: MANUAL ────────────────────────────────────────────────────────
        if (action === 'manual') {
            // Fix #1: Atomic idempotency lock on pending or moolre_pending using supabaseAdmin
            const { data: updatedTx, error: updateError } = await db
                .from('shop_wallet_transactions')
                .update({
                    status: 'completed',
                    admin_note: adminNote || null,
                    processed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', transactionId)
                .in('status', ['pending', 'moolre_pending'])
                .select()

            if (updateError) throw updateError
            
            // If rowsAffected == 0, another admin beat us to it, or it was already completed
            if (!updatedTx || updatedTx.length === 0) {
                return NextResponse.json({ error: 'This transaction is already completed or processing.' }, { status: 400 })
            }

            // Fix #10: Import directly, fire-and-forget, non-blocking
            Promise.allSettled([
                sendShopWithdrawalProcessedSMS(ownerPhone, firstName, tx.net_amount, tx.network || 'MoMo', paymentReceiverNumber),
                sendShopWithdrawalProcessedEmail(ownerEmail, firstName, shopName, tx.net_amount, paymentReceiverNumber, tx.network || 'MoMo')
            ]).catch(err => console.warn('[ShopAlert SMS] Non-fatal error:', err))

            return NextResponse.json({ success: true, status: 'completed', method: 'manual' })
        }

        // ─── ACTION: MOOLRE ────────────────────────────────────────────────────────
        if (action === 'moolre') {
            // Fix #1: Atomic idempotency lock to 'moolre_pending' before calling API
            // This also solves Fix #6 by guaranteeing it sits in moolre_pending even if DB writes fail later
            const { data: lockedTx, error: lockError } = await db
                .from('shop_wallet_transactions')
                .update({
                    status: 'moolre_pending',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', transactionId)
                .eq('status', 'pending')
                .select()

            if (lockError) throw lockError
            if (!lockedTx || lockedTx.length === 0) {
                return NextResponse.json({ error: 'This transaction is already being processed or is completed.' }, { status: 400 })
            }

            // Map network name to Moolre channel ID
            const channel = MOOLRE_CHANNEL_MAP[tx.network || '']
            if (channel === undefined) {
                // Unlock since we fail pre-flight validation
                await db.from('shop_wallet_transactions').update({ status: 'pending' }).eq('id', transactionId)
                return NextResponse.json(
                    { error: `Cannot determine Moolre channel for network: "${tx.network}". Use Manual payment instead.` },
                    { status: 400 }
                )
            }

            const transferResult = await initiateTransfer({
                amount: tx.net_amount,
                receiver: paymentReceiverNumber,
                channel,
                shopName,
                transactionId,           // Used as externalref
                bankId: tx.bank_id ?? undefined,
            })

            // API error or network error 
            if (!transferResult.success && transferResult.txstatus === null) {
                console.error(`[process-withdrawal] Moolre API error for tx ${transactionId}:`, transferResult.error)
                // Unlock back to pending
                await db.from('shop_wallet_transactions').update({ status: 'pending' }).eq('id', transactionId)
                return NextResponse.json(
                    { error: `Moolre API error: ${transferResult.error || 'Unknown error'}. Reverted to pending. Please try again.` },
                    { status: 502 }
                )
            }

            const { txstatus, transactionid: moolreTransactionId } = transferResult

            // txstatus=2 (Moolre explicit failure)
            if (txstatus === 2) {
                console.error(`[process-withdrawal] Moolre returned failure (txstatus=2) for tx ${transactionId}`)
                // Unlock back to pending so admin can try again or use manual
                await db.from('shop_wallet_transactions').update({ status: 'pending' }).eq('id', transactionId)
                return NextResponse.json(
                    { error: 'Moolre rejected the transfer. Reverted to pending. Please try again or use Manual payment.' },
                    { status: 400 }
                )
            }

            // txstatus=1 → completed immediately
            if (txstatus === 1) {
                // Fix #6: Capture DB error if this final write fails
                const { error: finalUpdateError } = await db.from('shop_wallet_transactions').update({
                    status: 'completed',
                    moolre_transaction_id: moolreTransactionId,
                    moolre_external_ref: transactionId,
                    moolre_status: txstatus,
                    admin_note: adminNote || null,
                    processed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }).eq('id', transactionId)

                if (finalUpdateError) {
                    console.error(`[process-withdrawal] DB Update failed after Moolre success for tx ${transactionId}:`, finalUpdateError)
                    // The money was sent. Because we locked it in `moolre_pending` in step 1, the cron will eventually find it and mark it completed. 
                    return NextResponse.json(
                        { error: 'Moolre transfer succeeded, but database update failed. The Cron will verify and complete it automatically.' },
                        { status: 500 }
                    )
                }

                // Fix #10: Import directly, fire-and-forget, non-blocking
                Promise.allSettled([
                    sendShopWithdrawalProcessedSMS(ownerPhone, firstName, tx.net_amount, tx.network || 'MoMo', paymentReceiverNumber),
                    sendShopWithdrawalProcessedEmail(ownerEmail, firstName, shopName, tx.net_amount, paymentReceiverNumber, tx.network || 'MoMo')
                ]).catch(err => console.warn('[ShopAlert SMS] Non-fatal error:', err))

                return NextResponse.json({
                    success: true,
                    status: 'completed',
                    method: 'moolre',
                    moolreTransactionId,
                })
            }

            // txstatus=0 or txstatus=3 → accepted by Moolre, awaiting confirmation
            if (txstatus === 0 || txstatus === 3) {
                // Fix #6: Capture DB error
                const { error: updateError } = await db.from('shop_wallet_transactions').update({
                    moolre_transaction_id: moolreTransactionId,
                    moolre_external_ref: transactionId,
                    moolre_status: txstatus,
                    admin_note: adminNote || null,
                    updated_at: new Date().toISOString(),
                }).eq('id', transactionId)

                if (updateError) {
                    console.error(`[process-withdrawal] DB Update failed for txstatus ${txstatus} on tx ${transactionId}:`, updateError)
                    // Cron will still handle it since it's locked as moolre_pending
                }

                return NextResponse.json({
                    success: true,
                    status: 'moolre_pending',
                    method: 'moolre',
                    moolreTransactionId,
                    message: 'Transfer submitted to Moolre. Awaiting network confirmation — cron will resolve.',
                })
            }

            // Unexpected txstatus
            return NextResponse.json(
                { error: `Unexpected Moolre txstatus: ${txstatus}. Check Moolre dashboard.` },
                { status: 502 }
            )
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

    } catch (error: any) {
        console.error('[process-withdrawal API]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
