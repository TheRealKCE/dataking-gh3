import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
    try {
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

        // Fetch prices from admin_settings
        const { data, error } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', ['agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d'])

        if (error) {
            console.error('Error fetching prices:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const prices = {
            '3d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_3d')?.value || '9.99'),
            '14d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_14d')?.value || '49.99'),
            '30d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_30d')?.value || '99.99')
        }

        return NextResponse.json({ prices })

    } catch (error: any) {
        console.error('Error in get-prices API:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
