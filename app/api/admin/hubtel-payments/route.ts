import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { parsePagination } from '@/lib/pagination'

/**
 * Admin view over the Hubtel payment record (hubtel_payment_logs).
 *
 * Read-only. The table is service-role-only under RLS — it holds customer MSISDNs and
 * raw provider payloads — so it is never queried from the browser client.
 */

async function requireAdmin() {
    const supabase = await createRouteHandlerClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

    if ((userData as any)?.role !== 'admin') {
        return { error: NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 }) }
    }
    return { userId: authUser.id }
}

/** GET /api/admin/hubtel-payments?search=&status=&flow=&startDate=&endDate=&page=&limit= */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if (auth.error) return auth.error

        const { searchParams } = new URL(request.url)
        const search = (searchParams.get('search') || '').trim()
        const status = searchParams.get('status') || ''
        const flow = searchParams.get('flow') || ''
        const startDate = searchParams.get('startDate') || ''
        const endDate = searchParams.get('endDate') || ''
        const { page, limit, from, to } = parsePagination(searchParams, {
            defaultLimit: 20,
            maxLimit: 100,
        })

        const db = createServerClient() as any
        let query = db
            .from('hubtel_payment_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)

        if (search) {
            // Escape the PostgREST or() delimiters so a stray comma or paren in the box
            // cannot break the filter apart.
            const term = search.replace(/[,()]/g, ' ').trim()
            if (term) {
                query = query.or(
                    `client_reference.ilike.%${term}%,payer_msisdn.ilike.%${term}%,transaction_id.ilike.%${term}%`
                )
            }
        }
        if (status && status !== 'all') query = query.eq('status', status)
        if (flow && flow !== 'all') query = query.eq('flow', flow)
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
        // endDate is a plain date from the picker — take the whole day.
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`)

        const { data, count, error } = await query
        if (error) {
            console.error('[AdminHubtelPayments] Query failed:', error.message)
            return NextResponse.json({ error: 'Could not load payment records' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            records: data || [],
            total: count ?? 0,
            page,
            limit,
        })
    } catch (e) {
        console.error('[AdminHubtelPayments] GET error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
