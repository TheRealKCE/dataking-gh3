import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendSMS } from '@/lib/sms-service'

interface BroadcastRequest {
    userIds?: string[]
    roleFilter?: 'all' | 'user' | 'sub-admin'
    message: string
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const body: BroadcastRequest = await request.json()
        const { userIds, roleFilter, message } = body

        if (!message || message.trim().length === 0) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        if (!userIds && !roleFilter) {
            return NextResponse.json({ error: 'Either userIds or roleFilter is required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Fetch recipients based on selection
        let query = supabase
            .from('users')
            .select('id, first_name, phone_number, role')
            .not('phone_number', 'is', null)

        if (userIds && userIds.length > 0) {
            // Specific users selected
            query = query.in('id', userIds)
        } else if (roleFilter && roleFilter !== 'all') {
            // Filter by role
            query = query.eq('role', roleFilter)
        }

        const { data: recipients, error: fetchError } = await query

        if (fetchError) {
            console.error('[SMSBroadcast] Error fetching recipients:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
        }

        if (!recipients || recipients.length === 0) {
            return NextResponse.json({ error: 'No recipients found with valid phone numbers' }, { status: 400 })
        }

        console.log(`[SMSBroadcast] Sending SMS to ${recipients.length} recipients`)

        // Send SMS to each recipient
        const results = {
            total: recipients.length,
            success: 0,
            failed: 0,
            errors: [] as string[]
        }

        for (const recipient of recipients as any[]) {
            if (!recipient.phone_number) {
                results.failed++
                results.errors.push(`${recipient.first_name || 'Unknown'}: No phone number`)
                console.warn(`[SMSBroadcast] Skipping user ${recipient.first_name} - no phone number`)
                continue
            }

            console.log(`[SMSBroadcast] Sending to ${recipient.first_name} (${recipient.phone_number})`)

            try {
                const result = await sendSMS({
                    recipient: recipient.phone_number,
                    message: message.trim()
                })

                if (result.success) {
                    results.success++
                    console.log(`[SMSBroadcast] ✅ Success for ${recipient.first_name}`)
                } else {
                    results.failed++
                    results.errors.push(`${recipient.first_name || 'Unknown'}: ${result.error}`)
                    console.error(`[SMSBroadcast] ❌ Failed for ${recipient.first_name}: ${result.error}`)
                }
            } catch (err: any) {
                results.failed++
                results.errors.push(`${recipient.first_name || 'Unknown'}: ${err.message}`)
                console.error(`[SMSBroadcast] ❌ Exception for ${recipient.first_name}:`, err)
            }
        }

        console.log(`[SMSBroadcast] Results: ${results.success} success, ${results.failed} failed`)

        return NextResponse.json({
            success: true,
            results
        })
    } catch (error: any) {
        console.error('[SMSBroadcast] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
