import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminAccess } from '@/lib/auth-utils'

// GET: Fetch all voucher types with stock counts
export async function GET() {
    try {
        const auth = await validateAdminAccess(false)
        if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

        const supabase = createServerClient()

        // Fetch all types (including inactive for admin view)
        const { data: types, error } = await (supabase.from('results_checker_types') as any)
            .select('*')
            .order('display_order', { ascending: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // For each type, get stock counts
        const typesWithStock = await Promise.all(
            (types || []).map(async (type: any) => {
                const { count: available } = await (supabase.from('results_checker_inventory') as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('type_id', type.id)
                    .eq('status', 'available')

                const { count: reserved } = await (supabase.from('results_checker_inventory') as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('type_id', type.id)
                    .eq('status', 'reserved')

                const { count: sold } = await (supabase.from('results_checker_inventory') as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('type_id', type.id)
                    .eq('status', 'sold')

                return { ...type, stock: { available: available || 0, reserved: reserved || 0, sold: sold || 0 } }
            })
        )

        return NextResponse.json({ data: typesWithStock })
    } catch (err: any) {
        console.error('[RC Types GET]', err)
        return NextResponse.json({ error: 'Failed to fetch types' }, { status: 500 })
    }
}

// POST: Create a new voucher type
export async function POST(request: NextRequest) {
    try {
        const auth = await validateAdminAccess(false)
        if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

        const body = await request.json()
        const { name, customer_price, agent_price, dealer_price, cost_price, display_order,
                bulk_quantity_threshold, bulk_customer_price, bulk_agent_price, bulk_dealer_price } = body

        if (!name || !customer_price || !agent_price || !cost_price) {
            return NextResponse.json({ error: 'Name, customer_price, agent_price, and cost_price are required' }, { status: 400 })
        }

        // Server-side pricing sanity check
        const cp = parseFloat(customer_price);
        const ap = parseFloat(agent_price);
        const dp = dealer_price ? parseFloat(dealer_price) : 0;
        const cost = parseFloat(cost_price);
        if (cp < cost || ap < cost || (dp > 0 && dp < cost)) {
            return NextResponse.json({ error: 'Selling prices cannot be below cost price' }, { status: 400 })
        }
        // Bulk price checks
        const bcp = bulk_customer_price ? parseFloat(bulk_customer_price) : null
        const bap = bulk_agent_price ? parseFloat(bulk_agent_price) : null
        const bdp = bulk_dealer_price ? parseFloat(bulk_dealer_price) : null
        if (bcp && bcp < cost) return NextResponse.json({ error: 'Bulk customer price cannot be below cost price' }, { status: 400 })
        if (bap && bap < cost) return NextResponse.json({ error: 'Bulk agent price cannot be below cost price' }, { status: 400 })
        if (bdp && bdp < cost) return NextResponse.json({ error: 'Bulk dealer price cannot be below cost price' }, { status: 400 })

        const supabase = createServerClient()
        const { data, error } = await (supabase.from('results_checker_types') as any)
            .insert({
                name,
                customer_price: cp,
                agent_price: ap,
                dealer_price: dp,
                cost_price: cost,
                display_order: display_order || 0,
                is_active: true,
                bulk_quantity_threshold: bulk_quantity_threshold ? parseInt(bulk_quantity_threshold) : null,
                bulk_customer_price: bcp,
                bulk_agent_price: bap,
                bulk_dealer_price: bdp,
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') return NextResponse.json({ error: 'A type with this name already exists' }, { status: 409 })
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (err: any) {
        console.error('[RC Types POST]', err)
        return NextResponse.json({ error: 'Failed to create type' }, { status: 500 })
    }
}
