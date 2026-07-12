import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { z } from 'zod'
import { phoneSchema } from '@/lib/validation'

/**
 * POST /api/dashboard/sub/withdraw
 * A sub-agent requests a withdrawal from their shop wallet.
 *
 * The request is created in the escalation chain, NOT paid immediately:
 *   status = 'shop_owner_pending', sub_approval_status = 'pending'
 * The upline Lead approves it (→ admin payout queue) via
 * /api/shop/sub-withdrawals/approve, or the escalation cron auto-forwards it to
 * the admin queue after the 48h window (escalate_after) lapses.
 *
 * Balance is deducted atomically on request and refunded by the reject RPC if
 * the Lead declines — mirroring the shop-owner withdrawal flow.
 */

const withdrawSchema = z
    .object({
        amount: z.union([
            z.number().positive(),
            z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number),
        ]),
        momoNumber: z
            .string()
            .min(8, 'Number is too short')
            .max(30, 'Number is too long')
            .regex(/^\d+$/, 'Must contain only digits'),
        network: z.enum(['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money']),
        accountName: z.string().min(2, 'Account name is required'),
    })
    .superRefine((data, ctx) => {
        if (!phoneSchema.safeParse(data.momoNumber).success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['momoNumber'],
                message: 'Must be a valid Ghanaian MoMo number (e.g. 0241234567)',
            })
        }
    })

const MIN_WITHDRAWAL = 10
const ESCALATE_WINDOW_HOURS = 48

export async function POST(req: NextRequest) {
    try {
        const supabaseAuth = await createRouteHandlerClient()
        const {
            data: { user },
        } = await supabaseAuth.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase: any = createServerClient()

        // 1. Caller must be an ACTIVE sub-agent
        const { data: subAgent } = await supabase
            .from('sub_agents')
            .select('status')
            .eq('user_id', user.id)
            .single()

        if (!subAgent) {
            return NextResponse.json({ error: 'Not a sub-agent' }, { status: 403 })
        }
        if (subAgent.status !== 'active') {
            return NextResponse.json(
                { error: 'Your sub-agent account is not active yet.' },
                { status: 403 }
            )
        }

        // 2. Validate input
        const body = await req.json()
        const validation = withdrawSchema.safeParse(body)
        if (!validation.success) {
            const details = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
            return NextResponse.json({ error: 'Invalid input', details }, { status: 400 })
        }

        const amount = validation.data.amount
        const momoNumber = validation.data.momoNumber.trim()
        const network = validation.data.network.trim()
        const accountName = validation.data.accountName.trim()

        if (amount < MIN_WITHDRAWAL) {
            return NextResponse.json(
                { error: `Minimum withdrawal is GH₵${MIN_WITHDRAWAL.toFixed(2)}` },
                { status: 400 }
            )
        }

        // 3. Fetch wallet
        const { data: wallet } = await supabase
            .from('shop_wallets')
            .select('id, balance')
            .eq('owner_id', user.id)
            .single()

        if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
        if (amount > wallet.balance) {
            return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
        }

        // 4. Deduct atomically (prevents double-spend)
        const { data: deductResult, error: deductError } = await supabase.rpc(
            'deduct_shop_wallet_balance',
            { p_user_id: user.id, p_amount: amount }
        )
        if (deductError) {
            if (deductError.message?.includes('INSUFFICIENT_BALANCE')) {
                return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
            }
            throw deductError
        }
        const newBalance = deductResult?.[0]?.new_balance ?? wallet.balance - amount

        // 5. Create the pending request in the Lead-approval chain
        const escalateAfter = new Date(
            Date.now() + ESCALATE_WINDOW_HOURS * 60 * 60 * 1000
        ).toISOString()

        const { error: txError } = await supabase.from('shop_wallet_transactions').insert({
            shop_wallet_id: wallet.id,
            type: 'withdrawal',
            amount,
            fee: 0,
            net_amount: amount,
            account_name: accountName,
            momo_number: momoNumber,
            network,
            payment_type: 'momo',
            description: `Sub withdrawal request — ${network}: ${momoNumber}`,
            status: 'shop_owner_pending',
            sub_approval_status: 'pending',
            escalate_after: escalateAfter,
            balance_snapshot: newBalance,
        })

        if (txError) {
            // Revert the deduction so the sub isn't debited for a failed request
            await supabase.rpc('credit_shop_wallet_balance', {
                p_user_id: user.id,
                p_amount: amount,
            })
            throw txError
        }

        return NextResponse.json({
            success: true,
            newBalance,
            message: 'Withdrawal request submitted. Your Lead will review it shortly.',
        })
    } catch (error: any) {
        console.error('[Sub Withdraw API]', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
