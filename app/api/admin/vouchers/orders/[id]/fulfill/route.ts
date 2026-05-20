import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'
import { createServerClient } from '@/lib/supabase'

/**
 * POST /api/admin/vouchers/orders/[id]/fulfill
 * Manually assign vouchers to a paid-but-out-of-stock order.
 * Used when stock was unavailable at payment time.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = createServerClient()
    const { id: orderId } = await params;

    // Load the order
    const { data: order, error: orderErr } = await (supabase as any)
        .from('results_checker_orders')
        .select('*')
        .eq('id', orderId)
        .single()

    if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status === 'completed') return NextResponse.json({ error: 'Order already fulfilled' }, { status: 400 })
    if (order.payment_status !== 'completed') return NextResponse.json({ error: 'Payment not confirmed for this order' }, { status: 400 })

    // Try to assign vouchers atomically
    const { data: vouchers, error: assignErr } = await (supabase as any).rpc(
        'assign_results_checker_vouchers',
        { p_type_id: order.type_id, p_quantity: order.quantity, p_order_id: orderId }
    )

    if (assignErr || !vouchers || vouchers.length === 0) {
        return NextResponse.json({ error: 'Insufficient inventory — please upload more vouchers first' }, { status: 400 })
    }

    // Finalize
    await (supabase as any).rpc('finalize_results_checker_sale', {
        p_order_id: orderId,
        p_user_id: order.user_id ?? null,
    })

    await (supabase as any)
        .from('results_checker_orders')
        .update({
            status: 'completed',
            inventory_ids: vouchers.map((v: any) => v.id),
            fulfilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

    // Deliver vouchers asynchronously
    try {
        const { deliverVouchers } = await import('@/lib/vouchers/notifications')
        deliverVouchers(order, vouchers).catch(console.error)
    } catch (_) {}

    return NextResponse.json({ success: true, fulfilled: vouchers.length })
}

