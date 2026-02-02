import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { prices } = body

        if (!prices) {
            return NextResponse.json({ error: 'Prices are required' }, { status: 400 })
        }

        // Update each price individually with proper error handling
        const updates = [
            { key: 'agent_upgrade_price_3d', value: String(prices['3d']) },
            { key: 'agent_upgrade_price_14d', value: String(prices['14d']) },
            { key: 'agent_upgrade_price_30d', value: String(prices['30d']) }
        ]

        for (const { key, value } of updates) {
            // Delete existing record if it exists
            await (supabase
                .from('admin_settings')
                .delete()
                .eq('key', key) as any)

            // Insert new record
            const { error } = await (supabase
                .from('admin_settings')
                .insert({ key, value }) as any)

            if (error) {
                console.error(`Error updating ${key}:`, error)
                return NextResponse.json(
                    { error: `Failed to update ${key}: ${error.message}` },
                    { status: 500 }
                )
            }
        }

        // Verify the updates
        const { data: verifyData, error: verifyError } = await (supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', ['agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d']) as any)

        if (verifyError) {
            console.error('Verification error:', verifyError)
        }

        const verified = {
            '3d': verifyData?.find((s: any) => s.key === 'agent_upgrade_price_3d')?.value || prices['3d'],
            '14d': verifyData?.find((s: any) => s.key === 'agent_upgrade_price_14d')?.value || prices['14d'],
            '30d': verifyData?.find((s: any) => s.key === 'agent_upgrade_price_30d')?.value || prices['30d']
        }

        return NextResponse.json({
            success: true,
            verified,
            message: `Prices updated: 3d=GHS${verified['3d']}, 14d=GHS${verified['14d']}, 30d=GHS${verified['30d']}`
        })

    } catch (error: any) {
        console.error('Error in update-prices API:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
