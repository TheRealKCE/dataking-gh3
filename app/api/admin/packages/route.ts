import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { adminShortTextSchema, adminLongTextSchema } from '@/lib/validation'

// Create admin client directly since createServerClient might not be exported customly
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

export async function GET(request: NextRequest) {
    const supabase = createRouteClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

    if ((user as any)?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
        .from('data_packages')
        .select('*')
        .order('network')
        .order('sort_order')

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
    const supabase = createRouteClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

    if ((user as any)?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const packageSchema = z.object({
        name: adminShortTextSchema.optional(),
        description: adminLongTextSchema.optional(),
    }).passthrough()

    const validation = packageSchema.safeParse(body)
    if (!validation.success) {
        const errorDetails = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        return NextResponse.json({ error: 'Invalid input', details: errorDetails }, { status: 400 })
    }

    // Explicitly cast insert to avoid type errors with string enums if mismatch
    const { data, error } = await (supabaseAdmin
        .from('data_packages') as any)
        .insert(body)
        .select()
        .single()

    if (error) {
        console.error('Create package error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
    const supabase = createRouteClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

    if ((user as any)?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const packageSchema = z.object({
        name: adminShortTextSchema.optional(),
        description: adminLongTextSchema.optional(),
    }).passthrough()

    const validation = packageSchema.safeParse(body)
    if (!validation.success) {
        const errorDetails = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        return NextResponse.json({ error: 'Invalid input', details: errorDetails }, { status: 400 })
    }

    const { id, ...updates } = validation.data

    if (!id) {
        return NextResponse.json({ error: 'Package ID required' }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin
        .from('data_packages') as any)
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('Update package error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
    const supabase = createRouteClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

    if ((user as any)?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Package ID required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
        .from('data_packages')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Delete package error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
