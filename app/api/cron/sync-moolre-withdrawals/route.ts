import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkTransferStatus } from '@/lib/moolre-transfer-service'

export async function GET(req: NextRequest) {
    // 1. Secure with CRON_SECRET
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerClient() as any
    const results = {
        processed: 0,
        completed: 0,
        stillPending: 0,
        errors: 0,
    }

    try {
        // 2. Fetch all moolre_pending transactions
        const { data: pendingTxns, error: fetchError } = await db
            .from('shop_wallet_transactions')
            .select(`
                id,
                moolre_external_ref,
                net_amount,
                momo_number,
                network,
                wallet:shop_wallets!inner(
                    owner_id
                )
            `)
            .eq('status', 'moolre_pending')

        if (fetchError) {
            console.error('[sync-moolre] Failed to fetch pending transactions:', fetchError)
            return NextResponse.json({ error: 'Database error', details: fetchError.message }, { status: 500 })
        }

        if (!pendingTxns || pendingTxns.length === 0) {
            return NextResponse.json({ message: 'No moolre_pending transactions found.', results })
        }

        console.log(`[sync-moolre] Checking ${pendingTxns.length} moolre_pending transactions...`)

        // 3. Check each pending transaction in series to avoid overwhelming Moolre API
        for (const tx of pendingTxns) {
            results.processed++

            const externalref = tx.moolre_external_ref || tx.id

            try {
                const status = await checkTransferStatus(externalref)

                if (status.txstatus === null) {
                    // Could not get a response — skip, leave as moolre_pending, try next run
                    console.warn(`[sync-moolre] Could not get status for tx ${tx.id}:`, status.error)
                    results.errors++
                    continue
                }

                if (status.txstatus === 1) {
                    // ✅ Completed — update DB and send SMS
                    const { error: updateError } = await db
                        .from('shop_wallet_transactions')
                        .update({
                            status: 'completed',
                            moolre_status: 1,
                            moolre_transaction_id: status.transactionid,
                            processed_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', tx.id)

                    if (updateError) {
                        console.error(`[sync-moolre] Failed to update tx ${tx.id} to completed:`, updateError)
                        results.errors++
                        continue
                    }

                    results.completed++
                    console.log(`[sync-moolre] ✅ tx ${tx.id} completed. Moolre ID: ${status.transactionid}`)

                    // Fetch owner details for SMS
                    try {
                        const { data: shopProfile } = await db
                            .from('shop_profiles')
                            .select('shop_name, owner_phone')
                            .eq('owner_id', tx.wallet.owner_id)
                            .single()

                        const { data: ownerUser } = await db
                            .from('users')
                            .select('first_name, email')
                            .eq('id', tx.wallet.owner_id)
                            .single()

                        if (shopProfile && ownerUser) {
                            // Fire SMS non-blocking
                            fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/shop/alerts`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    type: 'withdrawal_processed',
                                    payload: {
                                        phone: shopProfile.owner_phone,
                                        email: ownerUser.email,
                                        firstName: ownerUser.first_name,
                                        shopName: shopProfile.shop_name,
                                        amount: tx.net_amount,
                                        momoNumber: tx.momo_number,
                                        network: tx.network || 'MoMo',
                                    },
                                }),
                            }).catch(err => console.warn(`[sync-moolre] SMS error for tx ${tx.id}:`, err))
                        }
                    } catch (smsErr) {
                        // Non-fatal — transaction is already marked completed
                        console.warn(`[sync-moolre] Could not send SMS for tx ${tx.id}:`, smsErr)
                    }

                } else if (status.txstatus === 2) {
                    // ❌ Moolre explicitly failed — leave as moolre_pending, log only
                    // Admin will see the transaction still pending and can use "Pay Manually"
                    console.error(
                        `[sync-moolre] ❌ Moolre returned txstatus=2 (explicit failure) for tx ${tx.id}. ` +
                        `Leaving as moolre_pending. Admin must use "Pay Manually".`
                    )
                    results.errors++

                } else {
                    // txstatus=0 or txstatus=3 — still pending, check again next run
                    console.log(`[sync-moolre] ⏳ tx ${tx.id} still pending (txstatus=${status.txstatus})`)
                    results.stillPending++
                }

            } catch (txErr: any) {
                console.error(`[sync-moolre] Unexpected error processing tx ${tx.id}:`, txErr.message)
                results.errors++
            }
        }

        console.log('[sync-moolre] Run complete:', results)
        return NextResponse.json({ success: true, results })

    } catch (error: any) {
        console.error('[sync-moolre] Fatal cron error:', error)
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
    }
}
