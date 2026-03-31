import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // 1. Validate caller has the correct role
        const { data: dbUser } = await supabase
            .from('users')
            .select('role, id')
            .eq('id', user.id)
            .single()

        if (!dbUser || dbUser.role !== 'agent') {
            return NextResponse.json({ error: 'Forbidden. Only shop owners can withdraw.' }, { status: 403 })
        }

        const body = await req.json()
        const { amount, accountName, momoNumber, network, saveForLater } = body

        // 2. Format and validate inputs
        const amountNum = parseFloat(amount)
        if (!amount || amountNum <= 0 || isNaN(amountNum)) {
            return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
        }
        if (!network || !['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'].includes(network)) {
            return NextResponse.json({ error: 'Select a valid mobile money network' }, { status: 400 })
        }
        if (!accountName?.trim()) {
            return NextResponse.json({ error: 'Enter the account holder name' }, { status: 400 })
        }
        if (!momoNumber?.trim()) {
            return NextResponse.json({ error: 'Enter your MoMo number' }, { status: 400 })
        }

        // 3. Fetch current wallet balance and settings server-side
        const { data: wallet } = await supabase
            .from('shop_wallets')
            .select('id, balance, total_withdrawn')
            .eq('owner_id', user.id)
            .single()

        if (!wallet) return NextResponse.json({ error: 'Shop wallet not found' }, { status: 404 })

        // Fetch the shop's per-shop fee overrides (set by admin)
        const { data: shopProfile } = await supabase
            .from('shop_profiles')
            .select('paystack_fee_percent, withdrawal_fee_percent, withdrawal_fee_flat, min_withdrawal_amount')
            .eq('owner_id', user.id)
            .single()

        const ownerRole = dbUser.role || 'customer' // 'customer' or 'agent'

        // Fetch all relevant global settings keys in one query
        const { data: settingsRows } = await supabase
            .from('shop_global_settings')
            .select('key, value')
            .in('key', [
                `withdrawal_fee_percent_${ownerRole}`,
                `withdrawal_fee_flat_${ownerRole}`,
                `min_withdrawal_amount_${ownerRole}`,
                'withdrawal_fee_percent',
                'withdrawal_fee_flat',
                'min_withdrawal_amount',
            ])

        const globalMap: Record<string, number> = {}
        for (const row of (settingsRows || [])) {
            globalMap[row.key] = parseFloat(row.value)
        }

        // --- Role-Aware Fee Resolution ---
        // Priority: per-shop override (if not null) → role-specific global → legacy global → hardcoded default
        // Per-shop override of 0 means "deliberately free". Only null means "inherit global".
        function resolveWithdrawalFee(
            perShopValue: number | null | undefined,
            roleKey: string,
            legacyKey: string,
            hardcodedDefault: number
        ): number {
            if (perShopValue !== null && perShopValue !== undefined) return perShopValue
            if (globalMap[roleKey] != null) return globalMap[roleKey]
            if (globalMap[legacyKey] != null) return globalMap[legacyKey]
            return hardcodedDefault
        }

        const settings = {
            min_withdrawal_amount: resolveWithdrawalFee(
                shopProfile?.min_withdrawal_amount,
                `min_withdrawal_amount_${ownerRole}`,
                'min_withdrawal_amount',
                50
            ),
            withdrawal_fee_percent: resolveWithdrawalFee(
                shopProfile?.withdrawal_fee_percent,
                `withdrawal_fee_percent_${ownerRole}`,
                'withdrawal_fee_percent',
                2
            ),
            withdrawal_fee_flat: resolveWithdrawalFee(
                shopProfile?.withdrawal_fee_flat,
                `withdrawal_fee_flat_${ownerRole}`,
                'withdrawal_fee_flat',
                0
            ),
        }

        // 4. Security Checks: Server-side validation
        if (amountNum < settings.min_withdrawal_amount) {
            return NextResponse.json({ error: `Minimum withdrawal is GH₵${settings.min_withdrawal_amount.toFixed(2)}` }, { status: 400 })
        }
        if (amountNum > wallet.balance) {
            return NextResponse.json({ error: 'Insufficient shop wallet balance' }, { status: 400 })
        }

        // 5. Calculate fees and balances server-side
        const feePercent = (amountNum * settings.withdrawal_fee_percent) / 100
        const totalFee = feePercent + settings.withdrawal_fee_flat
        const netAmount = amountNum - totalFee
        const newBalance = wallet.balance - amountNum

        // 6. Execute atomic operations (or sequential writes if RPC is not immediately available)
        // Insert transaction and update balance
        
        // Step 6a: Insert the pending transaction with the snapshot
        const { error: txError } = await supabase.from('shop_wallet_transactions').insert({
            shop_wallet_id: wallet.id,
            type: 'withdrawal',
            amount: amountNum,
            fee: totalFee,
            net_amount: netAmount,
            account_name: accountName.trim(),
            momo_number: momoNumber.trim(),
            network: network,
            description: `Withdrawal request for ${accountName.trim()} — ${network}: ${momoNumber.trim()}`,
            status: 'pending',
            balance_snapshot: newBalance,
        })

        if (txError) throw txError

        // Step 6b: Deduct from balance immediately (pending)
        const { error: walletError } = await supabase.from('shop_wallets').update({
            balance: newBalance,
            total_withdrawn: (wallet.total_withdrawn || 0) + amountNum,
            updated_at: new Date().toISOString(),
        }).eq('id', wallet.id)

        if (walletError) throw walletError

        // Step 6c: Save detail for later if requested
        if (saveForLater) {
            // Check if they already have 5
            const { count } = await supabase
                .from('shop_payment_details')
                .select('*', { count: 'exact', head: true })
                .eq('shop_owner_id', user.id)
            
            if (count !== null && count < 5) {
                await supabase.from('shop_payment_details').insert({
                    shop_owner_id: user.id,
                    account_name: accountName.trim(),
                    momo_number: momoNumber.trim(),
                    network: network,
                    is_default: false,
                })
            }
        }

        // Return success with calculated values to the client if needed
        return NextResponse.json({ success: true, newBalance })

    } catch (error: any) {
        console.error('[Shop Withdraw API]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
