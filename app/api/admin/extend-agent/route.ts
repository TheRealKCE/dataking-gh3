import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendAgentExtensionSuccessSMS, sendAgentExpiryNotificationSMS } from '@/lib/sms-service'

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
        const { userId, days, action = 'extend' } = body // action: 'extend' or 'reduce'

        if (!userId || days === undefined) {
            return NextResponse.json({ error: 'userId and days are required' }, { status: 400 })
        }

        const daysNum = parseInt(days)
        if (isNaN(daysNum)) {
            return NextResponse.json({ error: 'days must be a valid number' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Fetch current user data
        const { data: targetUser, error: fetchError } = await (supabase
            .from('users') as any)
            .select('id, email, first_name, phone_number, agent_expires_at')
            .eq('id', userId)
            .single()

        if (fetchError || !targetUser) {
            console.error('[ExtendAgent] User fetch error:', fetchError)
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Calculate new expiry date
        const currentExpiry = targetUser.agent_expires_at
        const baseDate = currentExpiry ? new Date(currentExpiry) : new Date()

        // If already expired, start from now
        const now = new Date()
        const startingPoint = baseDate > now ? baseDate : now

        const newExpiry = new Date(startingPoint)
        newExpiry.setDate(newExpiry.getDate() + daysNum)

        // Check if the new expiry causes expiration
        const isNowExpired = newExpiry < now

        // Update the user's agent_expires_at
        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({ agent_expires_at: newExpiry.toISOString() })
            .eq('id', userId)

        if (updateError) {
            console.error('[ExtendAgent] Update error:', updateError)
            throw updateError
        }

        // Send SMS based on action and expiry status
        if (targetUser.phone_number) {
            try {
                if (action === 'extend') {
                    // Always send success SMS for extensions
                    await sendAgentExtensionSuccessSMS(
                        targetUser.phone_number,
                        newExpiry.toISOString()
                    )
                    console.log('[ExtendAgent] Extension SMS sent')
                } else if (action === 'reduce') {
                    if (isNowExpired) {
                        // Send expiry notification if reduction causes expiry
                        await sendAgentExpiryNotificationSMS(
                            targetUser.phone_number,
                            targetUser.first_name || 'Agent'
                        )
                        console.log('[ExtendAgent] Expiry SMS sent')
                    } else {
                        // No SMS for reductions that don't cause expiry
                        console.log(`[ExtendAgent] No SMS sent for reduction (still active)`)
                    }
                }
            } catch (smsError) {
                console.error('[ExtendAgent] SMS error:', smsError)
                // Don't fail the request if SMS fails
            }
        } else {
            console.warn(`[ExtendAgent] No phone number for user ${userId}`)
        }

        return NextResponse.json({
            success: true,
            userId,
            newExpiry: newExpiry.toISOString(),
            daysAdjusted: daysNum,
            action,
            isExpired: isNowExpired
        })
    } catch (error: any) {
        console.error('Extend Agent Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
