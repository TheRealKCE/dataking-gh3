import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        // 1. AUTHENTICATE USER
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. VERIFY ADMIN ROLE
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
        }

        // 3. CONTINUE WITH PRICE UPDATE LOGIC
        const body = await request.json()
        const { prices, showStrikethrough } = body

        if (!prices) {
            return NextResponse.json({ error: 'Prices are required' }, { status: 400 })
        }

        // Create admin client with service role key to bypass RLS
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

        // First, fetch current prices to move them to old prices
        const { data: currentData } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', ['agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d', 'agent_upgrade_price_permanent'])

        // Store current prices as old prices (only if they exist and are different)
        const oldPriceUpdates = []
        if (currentData) {
            const current3d = currentData.find(s => s.key === 'agent_upgrade_price_3d')?.value
            const current14d = currentData.find(s => s.key === 'agent_upgrade_price_14d')?.value
            const current30d = currentData.find(s => s.key === 'agent_upgrade_price_30d')?.value
            const currentPermanent = currentData.find(s => s.key === 'agent_upgrade_price_permanent')?.value

            if (current3d && current3d !== String(prices['3d'])) {
                oldPriceUpdates.push({ key: 'agent_upgrade_price_3d_old', value: current3d })
            }
            if (current14d && current14d !== String(prices['14d'])) {
                oldPriceUpdates.push({ key: 'agent_upgrade_price_14d_old', value: current14d })
            }
            if (current30d && current30d !== String(prices['30d'])) {
                oldPriceUpdates.push({ key: 'agent_upgrade_price_30d_old', value: current30d })
            }
            if (currentPermanent && currentPermanent !== String(prices['permanent'])) {
                oldPriceUpdates.push({ key: 'agent_upgrade_price_permanent_old', value: currentPermanent })
            }
        }

        // Update old prices
        for (const { key, value } of oldPriceUpdates) {
            await supabaseAdmin.from('admin_settings').delete().eq('key', key)
            await supabaseAdmin.from('admin_settings').insert({ key, value } as any)
        }

        // Update new prices
        const updates = [
            { key: 'agent_upgrade_price_3d', value: String(prices['3d']) },
            { key: 'agent_upgrade_price_14d', value: String(prices['14d']) },
            { key: 'agent_upgrade_price_30d', value: String(prices['30d']) },
            { key: 'agent_upgrade_price_permanent', value: String(prices['permanent']) }
        ]

        // Update strikethrough toggle if provided
        if (showStrikethrough !== undefined) {
            updates.push({ key: 'show_price_strikethrough', value: String(showStrikethrough) })
        }

        for (const { key, value } of updates) {
            // Delete existing record if it exists
            await supabaseAdmin.from('admin_settings').delete().eq('key', key)

            // Insert new record
            const { error } = await supabaseAdmin.from('admin_settings').insert({ key, value } as any)

            if (error) {
                console.error(`Error updating ${key}:`, error)
                return NextResponse.json(
                    { error: `Failed to update ${key}: ${error.message}` },
                    { status: 500 }
                )
            }
        }

        // Verify the updates
        const { data: verifyData, error: verifyError } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', ['agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d', 'agent_upgrade_price_permanent'])

        if (verifyError) {
            console.error('Verification error:', verifyError)
        }

        const verified = {
            '3d': (verifyData as any)?.find((s: any) => s.key === 'agent_upgrade_price_3d')?.value || prices['3d'],
            '14d': (verifyData as any)?.find((s: any) => s.key === 'agent_upgrade_price_14d')?.value || prices['14d'],
            '30d': (verifyData as any)?.find((s: any) => s.key === 'agent_upgrade_price_30d')?.value || prices['30d'],
            'permanent': (verifyData as any)?.find((s: any) => s.key === 'agent_upgrade_price_permanent')?.value || prices['permanent']
        }

        return NextResponse.json({
            success: true,
            verified,
            message: `Prices updated: 3d=GHS${verified['3d']}, 14d=GHS${verified['14d']}, 30d=GHS${verified['30d']}, permanent=GHS${verified['permanent']}`
        })

    } catch (error: any) {
        console.error('Error in update-prices API:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
