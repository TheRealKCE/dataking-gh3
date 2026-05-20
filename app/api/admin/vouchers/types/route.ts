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
        const { name, customer_price, agent_price, cost_price, display_order } = body

        if (!name || !customer_price || !agent_price || !cost_price) {
            return NextResponse.json({ error: 'Name, customer_price, agent_price, and cost_price are required' }, { status: 400 })
        }

        // Server-side pricing sanity check
        const cp = parseFloat(customer_price);
        const ap = parseFloat(agent_price);
        const cost = parseFloat(cost_price);
        if (cp < cost || ap < cost) {
            return NextResponse.json({ error: 'Selling prices cannot be below cost price' }, { status: 400 })
        }

        const supabase = createServerClient()
        const { data, error } = await (supabase.from('results_checker_types') as any)
            .insert({
                name,
                customer_price: parseFloat(customer_price),
                agent_price: parseFloat(agent_price),
                cost_price: parseFloat(cost_price),
                display_order: display_order || 0,
                is_active: true,
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
