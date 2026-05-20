import { NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = createServerClient()

    // Total orders & revenue
    const { data: orderStats } = await (supabase as any)
        .from('results_checker_orders')
        .select('status, total_paid, cost_price_at_time, quantity')

    const completed = (orderStats || []).filter((o: any) => o.status === 'completed')
    const revenue = completed.reduce((s: number, o: any) => s + (o.total_paid || 0), 0)
    const cost = completed.reduce((s: number, o: any) => s + ((o.cost_price_at_time || 0) * (o.quantity || 1)), 0)
    const totalOrders = (orderStats || []).length
    const completedOrders = completed.length
    const pendingOrders = (orderStats || []).filter((o: any) => o.status === 'pending').length

    // Stock summary per type
    const { data: types } = await (supabase as any)
        .from('results_checker_types')
        .select('id, name, is_active')
        .order('display_order')

    const stockSummary = await Promise.all((types || []).map(async (t: any) => {
        const { count: available } = await (supabase as any)
            .from('results_checker_inventory')
            .select('*', { count: 'exact', head: true })
            .eq('type_id', t.id).eq('status', 'available')
        const { count: sold } = await (supabase as any)
            .from('results_checker_inventory')
            .select('*', { count: 'exact', head: true })
            .eq('type_id', t.id).eq('status', 'sold')
        return { ...t, available: available || 0, sold: sold || 0, lowStock: (available || 0) < 10 }
    }))

    return NextResponse.json({
        revenue: parseFloat(revenue.toFixed(2)),
        cost: parseFloat(cost.toFixed(2)),
        profit: parseFloat((revenue - cost).toFixed(2)),
        totalOrders,
        completedOrders,
        pendingOrders,
        stockSummary,
    })
}
