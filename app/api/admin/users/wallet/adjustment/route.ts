import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { sendWalletTopupSuccessEmail } from '@/lib/email-service'
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

        // Check if requester is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, amount, type, description } = body

        if (!userId || amount === undefined || !type) {
            return NextResponse.json({ error: 'userId, amount, and type are required' }, { status: 400 })
        }

        const adjustmentAmount = parseFloat(amount)
        if (isNaN(adjustmentAmount) || adjustmentAmount <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }

        // ✅ SECURITY: Add maximum adjustment limit
        const MAX_ADJUSTMENT = 10000  // GHS 10,000
        if (adjustmentAmount > MAX_ADJUSTMENT) {
            return NextResponse.json({
                error: `Adjustment exceeds maximum limit of GHS ${MAX_ADJUSTMENT.toLocaleString()}. Please contact system administrator for larger adjustments.`
            }, { status: 400 })
        }

        // ✅ AUDIT: Log large adjustments
        if (adjustmentAmount > 1000) {
            console.warn('[AUDIT] Large wallet adjustment submitted', {
                type,
                amount: adjustmentAmount,
                hasDescription: Boolean(description),
            })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // CHECK ENV VAR
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is MISSING in environment variables!')
        }

        // 1. Get wallet
        const { data: wallet, error: walletFetchError } = await supabase
            .from('wallets')
            .select('id, balance, total_credited, total_spent')
            .eq('user_id', userId)
            .single()

        if (walletFetchError || !wallet) {
            console.error('[AdminWalletAdjustment] Wallet fetch error:', walletFetchError)
            return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
        }

        const isCredit = type === 'credit'
        const newBalance = isCredit
            ? ((wallet as any).balance + adjustmentAmount)
            : ((wallet as any).balance - adjustmentAmount)

        if (!isCredit && newBalance < 0) {
            return NextResponse.json({ error: 'User has insufficient balance for this debit' }, { status: 400 })
        }

        // 2. Update wallet
        const updateData: any = {
            balance: newBalance,
            updated_at: new Date().toISOString()
        }

        if (isCredit) {
            updateData.total_credited = ((wallet as any).total_credited || 0) + adjustmentAmount
        } else {
            updateData.total_spent = ((wallet as any).total_spent || 0) + adjustmentAmount
        }

        const { error: walletUpdateError } = await (supabase
            .from('wallets') as any)
            .update(updateData)
            .eq('id', (wallet as any).id)

        if (walletUpdateError) {
            console.error('[AdminWalletAdjustment] Wallet update error:', walletUpdateError)
            throw walletUpdateError
        }

        // 3. Log transaction
        const { error: transError } = await (supabase.from('wallet_transactions') as any).insert({
            wallet_id: (wallet as any).id,
            user_id: userId,
            type: type,
            amount: adjustmentAmount,
            description: description || 'Admin manual adjustment',
            source: 'admin',
            status: 'completed'
        })

        if (transError) {
            console.error('[AdminWalletAdjustment] Transaction log error:', transError)
        }

        // 4. Send notification
        await (supabase.from('notifications') as any).insert({
            user_id: userId,
            title: isCredit ? 'Wallet Credited' : 'Wallet Debited',
            message: `Your wallet has been ${isCredit ? 'credited' : 'debited'} with GHS ${adjustmentAmount.toFixed(2)}. ${description || ''}`,
            type: 'balance_updated',
            is_read: false
        })

        if (type === 'credit') {
            // 5. Fetch user data for notification
            const { data: user, error: userFetchError } = await supabase
                .from('users')
                .select('email, first_name, phone_number')
                .eq('id', userId)
                .single()

            if (user) {
                const reference = `MNL-${Date.now()}`

                // Email
                await sendWalletTopupSuccessEmail(
                    (user as any).email,
                    (user as any).first_name || 'Customer',
                    adjustmentAmount,
                    reference,
                    newBalance
                )

                // SMS
                if ((user as any).phone_number) {
                    try {
                        await sendWalletTopupSuccessSMS(
                            (user as any).phone_number,
                            {
                                amount: adjustmentAmount,
                                newBalance
                            }
                        )
                    } catch (smsError: any) {
                        console.error('[AdminWalletAdjustment] SMS notification failed:', smsError)
                    }
                } else {
                    console.warn('[AdminWalletAdjustment] Phone number missing for adjusted user')
                }
            } else {
                console.error('[AdminWalletAdjustment] User data could not be fetched for notification:', userFetchError)
            }
        }

        return NextResponse.json({
            success: true,
            newBalance
        })

    } catch (error: any) {
        console.error('Admin Wallet Adjustment Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
