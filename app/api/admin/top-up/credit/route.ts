import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendWalletTopupSuccessSMS } from '@/lib/sms-service'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: adminUser } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (adminUser?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const {
            userId,
            amount,
            description = 'Manual wallet top-up',
            markAsUnpaid = false,
            notes,
            deductFromDebt = false,
            deductAmount = 0,
            settlementId,
            idempotency_key
        } = body

        // Input validation
        if (!userId || !amount || amount <= 0) {
            return NextResponse.json({ error: 'Invalid input: userId and amount > 0 are required' }, { status: 400 })
        }

        if (deductFromDebt && (deductAmount <= 0 || deductAmount > amount)) {
            return NextResponse.json({
                error: 'Deduct amount must be greater than 0 and cannot exceed the top-up amount'
            }, { status: 400 })
        }

        const supabase = createServerClient() as any

        if (idempotency_key) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (!uuidRegex.test(idempotency_key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
            
            const { data: existing } = await supabase.from('wallet_transactions').select('id').eq('reference', idempotency_key).single()
            if (existing) return NextResponse.json({ error: 'DUPLICATE', id: existing.id }, { status: 409 })
        }

        // --- TIME-BASED IDEMPOTENCY CHECK ---
        // Block if same user_id + amount was already credited by admin in the last 5 seconds
        const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString()
        const { data: recentTx } = await supabase
            .from('wallet_transactions')
            .select('id')
            .eq('user_id', userId)
            .eq('amount', amount)
            .eq('source', 'admin')
            .eq('type', 'credit')
            .gte('created_at', fiveSecondsAgo)
            .limit(1)

        if (recentTx && recentTx.length > 0) {
            return NextResponse.json({
                error: 'DUPLICATE',
                message: `A top-up of this exact amount was already processed within the last 5 seconds. Please wait before retrying.`
            }, { status: 409 })
        }

        // --- FETCH WALLET ---
        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('user_id', userId)
            .single()

        if (walletError || !wallet) {
            return NextResponse.json({ error: 'User wallet not found' }, { status: 404 })
        }

        // --- COMPUTE NET CREDIT ---
        const netCredit = deductFromDebt ? amount - deductAmount : amount
        if (netCredit < 0) {
            return NextResponse.json({ error: 'Deduction exceeds top-up amount' }, { status: 400 })
        }

        // --- FETCH USER FOR SMS ---
        const { data: userRecord } = await supabase
            .from('users')
            .select('phone_number, first_name')
            .eq('id', userId)
            .single()

        // --- INSERT WALLET TRANSACTION ---
        const { data: newTx, error: txError } = await supabase
            .from('wallet_transactions')
            .insert({
                wallet_id: wallet.id,
                user_id: userId,
                type: 'credit',
                amount: netCredit,
                description: deductFromDebt
                    ? `${description} (GHS ${amount} cash received, GHS ${deductAmount} debt deducted)`
                    : description,
                source: 'admin',
                status: 'completed',
                reference: idempotency_key || null
            })
            .select('id')
            .single()

        if (txError || !newTx) {
            throw new Error(`Failed to create transaction: ${txError?.message}`)
        }

        // --- UPDATE WALLET BALANCE ---
        // ATOMIC: single RPC handles balance + total_credited in one transaction
        const { error: rpcError } = await supabase.rpc('admin_credit_wallet', {
            p_wallet_id: wallet.id,
            p_amount: netCredit
        })
        if (rpcError) {
            throw new Error(`Atomic credit failed: ${rpcError.message}`)
        }
        
        // Note: newBalance is computed client-side from the pre-read value.
        // This is only used for the SMS notification payload, not for the actual DB update (which is handled atomically via RPC).
        const newBalance = wallet.balance + netCredit

        // --- CREATE DEBT RECORD IF UNPAID ---
        if (markAsUnpaid) {
            await supabase
                .from('pending_settlements')
                .insert({
                    user_id: userId,
                    wallet_transaction_id: newTx.id,
                    amount_owed: netCredit,
                    amount_settled: 0,
                    status: 'pending',
                    notes: notes || null
                })
        }

        // --- SETTLE EXISTING DEBT IF FORCE SETTLEMENT ---
        if (deductFromDebt && settlementId && deductAmount > 0) {
            const { data: existingDebt } = await supabase
                .from('pending_settlements')
                .select('amount_owed, amount_settled')
                .eq('id', settlementId)
                .single()

            if (existingDebt) {
                const newAmountSettled = (existingDebt.amount_settled || 0) + deductAmount
                const isFullySettled = newAmountSettled >= existingDebt.amount_owed

                await supabase
                    .from('pending_settlements')
                    .update({
                        amount_settled: newAmountSettled,
                        status: isFullySettled ? 'settled' : 'partially_settled',
                        settled_at: isFullySettled ? new Date().toISOString() : null,
                        notes: notes || null
                    })
                    .eq('id', settlementId)
            }
        }

        // --- SEND SMS ---
        if (userRecord?.phone_number && netCredit > 0) {
            sendWalletTopupSuccessSMS(userRecord.phone_number, {
                amount: netCredit,
                newBalance
            }).catch(err => console.error('[Top-Up SMS] Error:', err))
        }

        return NextResponse.json({
            success: true,
            netCredit,
            newBalance,
            deducted: deductFromDebt ? deductAmount : 0,
            idempotencyBlocked: false
        })

    } catch (error: any) {
        console.error('[Top-Up Credit] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
