import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'
import { createServerClient } from '@/lib/supabase'
import { parsePagination } from '@/lib/pagination'

export async function GET(request: NextRequest) {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const typeId = searchParams.get('type_id')
    const { limit, from, to } = parsePagination(searchParams, { defaultLimit: 50, maxLimit: 100 })

    let query = (supabase as any)
        .from('results_checker_orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (status && status !== 'all') query = query.eq('status', status)
    if (typeId) query = query.eq('type_id', typeId)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [], total: count || 0, limit })
}
