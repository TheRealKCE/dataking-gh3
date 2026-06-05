import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendAgentUpgradeSuccessSMS, sendDealerUpgradeSuccessSMS } from '@/lib/sms-service'

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
        const { userId, role } = body

        if (!userId || !role) {
            return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // -----------------------------------------------------------------
        // Fetch the user's CURRENT role BEFORE changing it so we can pass
        // the old role to the pricing adjustment RPC below.
        // -----------------------------------------------------------------
        const { data: currentUser } = await (supabase
            .from('users') as any)
            .select('role')
            .eq('id', userId)
            .single()

        const oldRole: string = currentUser?.role ?? 'customer'

        // Calculate expiration based on new role
        const updateData: any = { role }
        if (role === 'agent') {
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 3) // 3-day agent subscription
            updateData.agent_expires_at = expiresAt.toISOString()
            // Clear dealer fields when promoting to agent
            updateData.dealer_expires_at = null
        } else if (role === 'dealer') {
            const now = new Date()
            const expiresAt = new Date(now)
            expiresAt.setDate(expiresAt.getDate() + 30) // 30-day dealer subscription
            updateData.dealer_claimed_at = now.toISOString()
            updateData.dealer_expires_at = expiresAt.toISOString()
            updateData.agent_expires_at = null
        } else {
            updateData.agent_expires_at = null
        }

        const { error: updateError } = await (supabase
            .from('users') as any)
            .update(updateData)
            .eq('id', userId)

        if (updateError) {
            console.error('[AdminRoleUpdate] Update error:', updateError)
            throw updateError
        }

        // -----------------------------------------------------------------
        // Auto-adjust shop pricing to preserve the owner's profit margins.
        // This replaces the old "deactivate shop on role change" behaviour.
        // The shop stays live; only selling prices are silently recalculated.
        // Also resets per-shop fee overrides so the shop inherits the correct
        // global fee defaults for the new role.
        // -----------------------------------------------------------------
        if (oldRole !== role) {
            try {
                const { data: rpcResult, error: rpcError } = await (supabase as any)
                    .rpc('adjust_shop_pricing_for_role_change', {
                        p_user_id: userId,
                        p_old_role: oldRole,
                        p_new_role: role,
                    })

                if (rpcError) {
                    // Log but don't fail — pricing adjustment is non-blocking
                    console.error('[AdminRoleUpdate] Pricing RPC error:', rpcError)
                } else {
                    console.log('[AdminRoleUpdate] Pricing adjustment result:', rpcResult)
                }
            } catch (rpcErr) {
                console.error('[AdminRoleUpdate] Unexpected RPC error:', rpcErr)
            }

            // Reset shop fee overrides to null so the shop inherits global defaults
            // for the user's new role. Non-blocking — failure does not abort the role change.
            try {
                await (supabase
                    .from('shop_profiles') as any)
                    .update({
                        paystack_fee_percent:   null,
                        withdrawal_fee_percent: null,
                        withdrawal_fee_flat:    null,
                        min_withdrawal_amount:  null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('owner_id', userId)
                console.log('[AdminRoleUpdate] Shop fee overrides reset')
            } catch (resetErr) {
                console.error('[AdminRoleUpdate] Failed to reset shop fee overrides (non-fatal):', resetErr)
            }
        }

        // Send SMS notification if user was upgraded to dealer
        if (role === 'dealer') {
            try {
                const { data: userDetails } = await (supabase
                    .from('users') as any)
                    .select('phone_number, first_name, dealer_expires_at')
                    .eq('id', userId)
                    .single()

                if (userDetails?.phone_number) {
                    await sendDealerUpgradeSuccessSMS(
                        userDetails.phone_number,
                        userDetails.first_name || 'User',
                        userDetails.dealer_expires_at
                    )
                    console.log('[AdminRoleUpdate] Dealer SMS sent')
                } else {
                    console.warn(`[AdminRoleUpdate] No phone number for dealer user ${userId}`)
                }
            } catch (smsError) {
                console.error('[AdminRoleUpdate] Dealer SMS error:', smsError)
            }
        }

        // Send SMS notification if user was upgraded to agent
        if (role === 'agent') {
            try {
                const { data: userDetails } = await (supabase
                    .from('users') as any)
                    .select('phone_number, first_name')
                    .eq('id', userId)
                    .single()

                if (userDetails?.phone_number) {
                    const expiryDate = new Date()
                    expiryDate.setDate(expiryDate.getDate() + 3)

                    await sendAgentUpgradeSuccessSMS(
                        userDetails.phone_number,
                        userDetails.first_name || 'User',
                        '3 Days',
                        3,
                        expiryDate.toISOString()
                    )
                    console.log('[AdminRoleUpdate] SMS sent')
                } else {
                    console.warn(`[AdminRoleUpdate] No phone number for user ${userId}`)
                }
            } catch (smsError) {
                console.error('[AdminRoleUpdate] SMS error:', smsError)
                // Don't fail the request if SMS fails
            }
        }

        return NextResponse.json({
            success: true,
            userId,
            newRole: role
        })
    } catch (error: any) {
        console.error('Admin Role Update Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
