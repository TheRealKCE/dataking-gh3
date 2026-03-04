import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get shop ID
    const { data: shop } = await supabase
        .from('shop_profiles')
        .select('id')
        .eq('owner_id', session.user.id)
        .single()

    if (!shop) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const { data: announcement } = await supabase
        .from('shop_announcements')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    return NextResponse.json({ announcement })
}

export async function POST(req: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message } = await req.json()

    if (!message) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // 1. Get shop ID
    const { data: shop } = await supabase
        .from('shop_profiles')
        .select('id')
        .eq('owner_id', session.user.id)
        .single()

    if (!shop) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // 2. Check for active admin announcement on storefronts (Hierarchy Rule)
    const { data: adminAnn } = await supabase
        .from('system_announcements')
        .select('id')
        .eq('is_active', true)
        .in('visible_on', ['storefronts', 'both'])
        .limit(1)
        .maybeSingle()

    if (adminAnn) {
        return NextResponse.json({
            error: 'blocked_by_admin',
            message: 'An official admin announcement is currently active on storefronts. Your announcement cannot be set right now.'
        }, { status: 403 })
    }

    // 3. Deactivate all existing ones for this shop
    await supabase
        .from('shop_announcements')
        .update({ is_active: false })
        .eq('shop_id', shop.id)

    // 4. Insert new one
    const { data, error } = await supabase
        .from('shop_announcements')
        .insert({
            shop_id: shop.id,
            message: message.trim(),
            is_active: true
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
    }

    return NextResponse.json({ announcement: data })
}

export async function DELETE() {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: shop } = await supabase
        .from('shop_profiles')
        .select('id')
        .eq('owner_id', session.user.id)
        .single()

    if (!shop) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const { error } = await supabase
        .from('shop_announcements')
        .update({ is_active: false })
        .eq('shop_id', shop.id)

    if (error) {
        return NextResponse.json({ error: 'Failed to deactivate announcement' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
