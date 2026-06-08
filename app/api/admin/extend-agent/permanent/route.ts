import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { sendPermanentAgentUpgradeSuccessSMS } from '@/lib/sms-service'
import { sendPermanentAgentUpgradeSuccessEmail } from '@/lib/email-service'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
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
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Fetch user data for alerts
        const { data: userDetails, error: userError } = await (supabase
            .from('users') as any)
            .select('email, phone_number, first_name')
            .eq('id', userId)
            .single()

        if (userError || !userDetails) {
            console.error('[AdminRoleUpdate] User fetch error:', userError)
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Set role to agent and agent_expires_at to null for permanent status
        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({
                role: 'agent',
                agent_expires_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (updateError) {
            console.error('[AdminPermanentRoleUpdate] Update error:', updateError)
            throw updateError
        }

        // Reset shop fee overrides to null so the shop inherits agent global defaults.
        // Non-blocking — failure does not abort the permanent upgrade.
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
            console.log('[AdminPermanentRoleUpdate] Shop fee overrides reset')
        } catch (resetErr) {
            console.error('[AdminPermanentRoleUpdate] Failed to reset shop fee overrides (non-fatal):', resetErr)
        }

        // Send SMS notification
        if (userDetails?.phone_number) {
            try {
                await sendPermanentAgentUpgradeSuccessSMS(
                    userDetails.phone_number
                )
                console.log('[AdminRoleUpdate] Permanent SMS sent')
            } catch (smsError) {
                console.error('[AdminRoleUpdate] SMS error:', smsError)
            }
        }

        // Send Email notification
        if (userDetails?.email) {
            try {
                await sendPermanentAgentUpgradeSuccessEmail(
                    userDetails.email,
                    userDetails.first_name || 'User'
                )
                console.log('[AdminRoleUpdate] Permanent email sent')
            } catch (emailError) {
                console.error('[AdminRoleUpdate] Email error:', emailError)
            }
        }

        return NextResponse.json({
            success: true,
            userId,
            newRole: 'agent',
            isPermanent: true
        })
    } catch (error: any) {
        console.error('Admin Permanent Role Update Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
