import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
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

        // 2. FETCH UPGRADE PRICES
        // (Removed admin-only restriction - pricing is public information for self-service upgrades)
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

        // Fetch prices from admin_settings (including old prices and strikethrough toggle)
        const { data, error } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', [
                'agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d',
                'agent_upgrade_price_3d_old', 'agent_upgrade_price_14d_old', 'agent_upgrade_price_30d_old',
                'show_price_strikethrough'
            ])

        if (error) {
            console.error('Error fetching prices:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const prices = {
            '3d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_3d')?.value || '9.99'),
            '14d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_14d')?.value || '49.99'),
            '30d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_30d')?.value || '99.99')
        }

        const oldPrices = {
            '3d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_3d_old')?.value || '0'),
            '14d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_14d_old')?.value || '0'),
            '30d': parseFloat(data?.find(s => s.key === 'agent_upgrade_price_30d_old')?.value || '0')
        }

        const showStrikethrough = data?.find(s => s.key === 'show_price_strikethrough')?.value === 'true'

        return NextResponse.json({ prices, oldPrices, showStrikethrough })

    } catch (error: any) {
        console.error('Error in get-prices API:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
