import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()

        const { data: tiers, error } = await supabaseUserClient
            .from('marketplace_promotion_tiers')
            .select('*')
            .eq('is_active', true)
            .order('tier_level')

        if (error) {
            console.error('[Promotion Config] Query error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch promotion tiers' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            tiers: tiers || [],
        })
    } catch (error) {
        console.error('[Promotion Config] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
