import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { areCronJobsEnabled, cronDisabledResponse, isValidCronRequest } from '@/lib/cron-control'

let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
    if (!supabaseAdmin) {
        supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )
    }
    return supabaseAdmin!
}

export async function GET(request: Request) {
    try {
        if (!areCronJobsEnabled()) return cronDisabledResponse()

        if (!isValidCronRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = getSupabaseAdmin()

        // Check if auto-upgrade toggle is enabled
        const { data: setting } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'auto_upgrade_expired_dealers')
            .single()

        if (!setting || setting.value !== 'true') {
            return NextResponse.json({ message: 'Auto-upgrade for expired dealers is disabled' })
        }

        // Find dealers who expired more than 3 days ago (grace period elapsed)
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

        const { data: expiredDealers, error: fetchError } = await supabase
            .from('users')
            .select('id, first_name, phone_number, dealer_expires_at')
            .eq('role', 'dealer')
            .lt('dealer_expires_at', threeDaysAgo.toISOString())

        if (fetchError) {
            console.error('[AutoUpgradeDealers] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        if (!expiredDealers || expiredDealers.length === 0) {
            return NextResponse.json({ message: 'No expired dealers eligible for auto-upgrade' })
        }

        console.log(`[AutoUpgradeDealers] Found ${expiredDealers.length} dealers to upgrade`)

        const results = []
        const agentExpiresAt = new Date()
        agentExpiresAt.setDate(agentExpiresAt.getDate() + 30)

        for (const dealer of expiredDealers) {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    role: 'agent',
                    agent_expires_at: agentExpiresAt.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', dealer.id)
                .eq('role', 'dealer')

            if (updateError) {
                console.error(`[AutoUpgradeDealers] Failed to upgrade dealer ${dealer.id}:`, updateError)
                results.push({ id: dealer.id, status: 'failed', error: updateError.message })
            } else {
                console.log(`[AutoUpgradeDealers] Upgraded dealer ${dealer.id} to agent`)
                results.push({ id: dealer.id, status: 'upgraded' })
            }
        }

        return NextResponse.json({
            message: 'Auto-upgrade process completed',
            processed: results.length,
            details: results
        })

    } catch (error: any) {
        console.error('[AutoUpgradeDealers] Exception:', error)
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
    }
}
