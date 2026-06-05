import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'
import { createServerClient } from '@/lib/supabase'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { id } = await params;

    const supabase = createServerClient()
    const body = await request.json()
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) updates.name = body.name
    if (body.customer_price !== undefined) updates.customer_price = parseFloat(body.customer_price)
    if (body.agent_price !== undefined) updates.agent_price = parseFloat(body.agent_price)
    if (body.dealer_price !== undefined) updates.dealer_price = parseFloat(body.dealer_price) || 0
    if (body.cost_price !== undefined) updates.cost_price = parseFloat(body.cost_price)
    if (body.display_order !== undefined) updates.display_order = parseInt(body.display_order)
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const cp = updates.customer_price
    const ap = updates.agent_price
    const dp = updates.dealer_price
    const cost = updates.cost_price
    if (cp !== undefined && cost !== undefined && cp < cost)
        return NextResponse.json({ error: 'Customer price cannot be below cost price' }, { status: 400 })
    if (ap !== undefined && cost !== undefined && ap < cost)
        return NextResponse.json({ error: 'Agent price cannot be below cost price' }, { status: 400 })
    if (dp !== undefined && dp > 0 && cost !== undefined && dp < cost)
        return NextResponse.json({ error: 'Dealer price cannot be below cost price' }, { status: 400 })

    const { data, error } = await (supabase as any)
        .from('results_checker_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { id } = await params;

    const supabase = createServerClient()
    const { error } = await (supabase as any)
        .from('results_checker_types')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

