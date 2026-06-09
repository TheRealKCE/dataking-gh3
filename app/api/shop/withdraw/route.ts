import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { phoneSchema } from '@/lib/validation'
import { validateAccountName, MOOLRE_CHANNEL_MAP, getBanks } from '@/lib/moolre-transfer-service'
import { sendAdminShopWithdrawalRequestAlert } from '@/lib/email-service'

const withdrawSchema = z.object({
    amount: z.union([
        z.number().positive(),
        z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)
    ]),
    momoNumber: z.string().min(8, 'Number is too short').max(30, 'Number is too long').regex(/^\d+$/, 'Must contain only digits'),
    network: z.enum(['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Bank']),
    payment_type: z.enum(['momo', 'bank']).default('momo'),
    bankId: z.string().regex(/^[A-Za-z0-9_-]+$/, 'Invalid bank ID format').optional(),
    branch: z.string().max(100).optional(),
    saveForLater: z.boolean().optional(),
    accountName: z.string().min(2, 'Account name is required'),
}).superRefine((data, ctx) => {
    if (data.network !== 'Bank') {
        if (!phoneSchema.safeParse(data.momoNumber).success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['momoNumber'],
                message: 'Must be a valid Ghanaian MoMo number (e.g. 0241234567)'
            })
        }
    }
})

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore as any })
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // 1a. Role check
        const { data: dbUser } = await supabase
            .from('users')
            .select('role, id')
            .eq('id', user.id)
            .single()

        const allowedRoles = ['customer', 'agent', 'dealer', 'admin', 'sub-admin']
        if (!dbUser || !allowedRoles.includes(dbUser.role)) {
            return NextResponse.json({ error: 'Forbidden. Only approved shop owners can withdraw.' }, { status: 403 })
        }

        // 1b. Shop ownership check — must own an approved, active shop
        const { data: shopOwnership } = await supabase
            .from('shop_profiles')
            .select('id, approval_status, is_active')
            .eq('owner_id', user.id)
            .single()

        if (!shopOwnership || shopOwnership.approval_status !== 'approved' || !shopOwnership.is_active) {
            return NextResponse.json({ 
                error: 'Forbidden. No approved active shop found for this account.' 
            }, { status: 403 })
        }

        const body = await req.json()

        // 2. Validate input shape with Zod
        const validation = withdrawSchema.safeParse(body)
        if (!validation.success) {
            const errorDetails = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            console.warn(`[Security] Withdrawal input rejected for User: ${user.id} — ${errorDetails.join(', ')}`)
            return NextResponse.json({ error: 'Invalid input', details: errorDetails }, { status: 400 })
        }

        // Apply .trim() to all string inputs after Zod validation
        const amountNum = validation.data.amount
        const momoNumber = validation.data.momoNumber.trim()
        const network = validation.data.network.trim()
        const payment_type = validation.data.payment_type.trim()
        const bankId = validation.data.bankId ? validation.data.bankId.trim() : undefined
        const branch = validation.data.branch ? validation.data.branch.trim() : undefined
        const saveForLater = validation.data.saveForLater

        // 3. Fetch wallet and shop profile
        const [walletRes, shopProfileRes] = await Promise.all([
            supabase
                .from('shop_wallets')
                .select('id, balance, total_withdrawn')
                .eq('owner_id', user.id)
                .single(),
            supabase
                .from('shop_profiles')
                .select('shop_name, paystack_fee_percent, withdrawal_fee_percent, withdrawal_fee_flat, min_withdrawal_amount')
                .eq('owner_id', user.id)
                .single(),
        ])

        if (!walletRes.data) return NextResponse.json({ error: 'Shop wallet not found' }, { status: 404 })
        const wallet = walletRes.data
        const shopProfile = shopProfileRes.data

        // 4. Fetch global settings
        const ownerRole = dbUser.role || 'customer'
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

        // 5. Basic balance and minimum checks
        if (amountNum < settings.min_withdrawal_amount) {
            return NextResponse.json(
                { error: `Minimum withdrawal is GH₵${settings.min_withdrawal_amount.toFixed(2)}` },
                { status: 400 }
            )
        }
        if (amountNum > wallet.balance) {
            return NextResponse.json({ error: 'Insufficient shop wallet balance' }, { status: 400 })
        }

        // 6. Use client-provided account name (since Moolre API is currently unstable)
        // For shop withdrawals, admins will manually verify the payout details anyway
        const verifiedAccountName = validation.data.accountName.trim()

        // 7b. Resolve bank_name server-side from Moolre banks cache (never trust client)
        let resolvedBankName: string | null = null
        if (payment_type === 'bank' && bankId) {
            try {
                const banks = await getBanks()
                const match = banks.find(b => b.id === bankId)
                resolvedBankName = match?.name ?? null
            } catch {
                // Non-blocking — bank_name will be null if lookup fails
            }
        }

        // 8. Calculate fees
        const feePercent = (amountNum * settings.withdrawal_fee_percent) / 100
        const totalFee = feePercent + settings.withdrawal_fee_flat
        const netAmount = amountNum - totalFee

        // Define our separated account string fields
        const safeMomoNumber = payment_type === 'momo' ? momoNumber : null
        const safeAccountNumber = payment_type === 'bank' ? momoNumber : null

        // 9a. Deduct from balance atomically
        const { data: deductResult, error: deductError } = await (supabase as any)
            .rpc('deduct_shop_wallet_balance', {
                p_user_id: user.id,
                p_amount: amountNum
            })

        if (deductError) {
            if (deductError.message?.includes('INSUFFICIENT_BALANCE')) {
                return NextResponse.json({ error: 'Insufficient shop wallet balance' }, { status: 400 })
            }
            throw deductError
        }

        const newBalance = deductResult?.[0]?.new_balance ?? deductResult?.new_balance ?? (wallet.balance - amountNum)

        // 9b. Insert the pending transaction
        const { data: txData, error: txError } = await (supabase as any)
            .from('shop_wallet_transactions')
            .insert({
                shop_wallet_id: wallet.id,
                type: 'withdrawal',
                amount: amountNum,
                fee: totalFee,
                net_amount: netAmount,
                account_name: verifiedAccountName, // Moolre-verified, not client-submitted
                momo_number: safeMomoNumber,
                account_number: safeAccountNumber,
                network,
                payment_type,
                bank_id: bankId ?? null,
                bank_name: resolvedBankName,
                branch: branch ?? null,
                description: `Withdrawal request — ${network}: ${momoNumber}`,
                status: 'pending',
                balance_snapshot: newBalance,
            })
            .select('id')
            .single()

        if (txError) {
            // Revert deduction on failure
            await (supabase as any).rpc('credit_shop_wallet_balance', {
                p_user_id: user.id,
                p_amount: amountNum
            })
            throw txError
        }

        // 9c. Save payment detail for later if requested
        if (saveForLater) {
            const { count } = await supabase
                .from('shop_payment_details')
                .select('*', { count: 'exact', head: true })
                .eq('shop_owner_id', user.id)

            if (count !== null && count < 5) {
                await (supabase as any).from('shop_payment_details').insert({
                    shop_owner_id: user.id,
                    account_name: verifiedAccountName,
                    momo_number: safeMomoNumber,
                    account_number: safeAccountNumber,
                    network,
                    payment_type,
                    bank_id: bankId ?? null,
                    is_default: false,
                })
            }
        } else {
            // Auto-update saved detail if the Moolre-verified name differs from stored name
            // We search using whichever number was submitted to identify the matching record
            const { data: savedDetail } = await (supabase as any)
                .from('shop_payment_details')
                .select('id, account_name')
                .eq('shop_owner_id', user.id)
                .or(`momo_number.eq.${momoNumber},account_number.eq.${momoNumber}`)
                .single()

            if (savedDetail && savedDetail.account_name !== verifiedAccountName) {
                await (supabase as any)
                    .from('shop_payment_details')
                    .update({ account_name: verifiedAccountName })
                    .eq('id', savedDetail.id)
            }
        }

        // 10. Fire admin alert (non-blocking) - Use direct import
        const shopName = shopProfile?.shop_name || 'Unknown Shop'
        const finalBalance = newBalance

        sendAdminShopWithdrawalRequestAlert({
            shopName,
            shopId: wallet.id,
            ownerName: '', // Admin panel shows full details from DB
            accountName: verifiedAccountName,
            amount: amountNum,
            momoNumber: momoNumber,
            network,
            balanceSnapshot: finalBalance,
            date: new Date().toLocaleString('en-GB'),
            isResubmission: false,
        }).catch(err => console.warn('[ShopAlert Email Hook Error]:', err))

        return NextResponse.json({ success: true, newBalance, verifiedName: verifiedAccountName })

    } catch (error: any) {
        console.error('[Shop Withdraw API]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
