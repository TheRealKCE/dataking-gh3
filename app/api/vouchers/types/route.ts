import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

// GET: Fetch active voucher types with stock counts — accessible to any authenticated user
export async function GET() {
    try {
        // Require authentication (any logged-in user)
        const supabaseAuth = await createRouteHandlerClient()
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const db = createServerClient() as any

        // Fetch only active types
        const { data: types, error } = await db
            .from('results_checker_types')
            .select('id, name, customer_price, agent_price, dealer_price, bulk_pricing, is_active, display_order')
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Attach stock counts for each active type
        const typesWithStock = await Promise.all(
            (types || []).map(async (type: any) => {
                const { count: available } = await db
                    .from('results_checker_inventory')
                    .select('*', { count: 'exact', head: true })
                    .eq('type_id', type.id)
                    .eq('status', 'available')

                return {
                    ...type,
                    bulk_pricing: Array.isArray(type.bulk_pricing) ? type.bulk_pricing : [],
                    stock: { available: available || 0 }
                }
            })
        )

        return NextResponse.json({ data: typesWithStock })
    } catch (err: any) {
        console.error('[RC Public Types GET]', err)
        return NextResponse.json({ error: 'Failed to fetch types' }, { status: 500 })
    }
}
