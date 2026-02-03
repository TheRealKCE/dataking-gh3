import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendAgentRenewalReminderSMS } from '@/lib/sms-service'

// Initialize Supabase admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function GET(request: Request) {
    try {
        // Authenticate the request (optional, e.g., via a secret header from the cron provider)
        const authHeader = request.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 1. Calculate the time window (expiring in 24 to 48 hours)
        // We look for users expiring tomorrow
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)

        const dayAfterTomorrow = new Date()
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

        const tomorrowISO = tomorrow.toISOString().split('T')[0] // Just the date part

        // 2. Fetch agents expiring tomorrow
        // Since agent_expires_at is a timestamp, we check for the entire day tomorrow
        const { data: expiringAgents, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, first_name, phone_number, agent_expires_at')
            .eq('role', 'agent')
            .gte('agent_expires_at', tomorrow.toISOString())
            .lt('agent_expires_at', dayAfterTomorrow.toISOString())

        if (fetchError) {
            console.error('[AgentReminder] Error fetching expiring agents:', fetchError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        if (!expiringAgents || expiringAgents.length === 0) {
            return NextResponse.json({ message: 'No agents expiring within the next 24-48 hours' })
        }

        console.log(`[AgentReminder] Found ${expiringAgents.length} agents expiring soon`)

        const results = []

        for (const agent of expiringAgents) {
            // 3. Check if we already sent a reminder for this user recently
            // We check for a notification with title 'Agent Role Expiring Soon' sent in the last 2 days
            const twoDaysAgo = new Date()
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

            const { data: existingNotification } = await supabaseAdmin
                .from('notifications')
                .select('id')
                .eq('user_id', agent.id)
                .eq('title', 'Agent Role Expiring Soon ⚠️')
                .gte('created_at', twoDaysAgo.toISOString())
                .limit(1)

            if (existingNotification && existingNotification.length > 0) {
                console.log(`[AgentReminder] Reminder already sent for user ${agent.id}`)
                results.push({ id: agent.id, status: 'already_sent' })
                continue
            }

            // 4. Send SMS
            if (agent.phone_number) {
                const smsResult = await sendAgentRenewalReminderSMS(
                    agent.phone_number,
                    agent.first_name || 'Agent'
                )

                if (smsResult.success) {
                    // 5. Log notification to prevent duplicate reminders
                    await supabaseAdmin
                        .from('notifications')
                        .insert({
                            user_id: agent.id,
                            title: 'Agent Role Expiring Soon ⚠️',
                            message: 'Your Agent Role plan is about to expire, kindly extend your plan to continue enjoying the benefits thank you.',
                            type: 'system',
                        })

                    results.push({ id: agent.id, status: 'success' })
                } else {
                    console.error(`[AgentReminder] Failed to send SMS to ${agent.id}:`, smsResult.error)
                    results.push({ id: agent.id, status: 'failed', error: smsResult.error })
                }
            } else {
                results.push({ id: agent.id, status: 'no_phone' })
            }
        }

        return NextResponse.json({
            message: 'Reminder process completed',
            processed: results.length,
            details: results
        })

    } catch (error: any) {
        console.error('[AgentReminder] Exception:', error)
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
    }
}
