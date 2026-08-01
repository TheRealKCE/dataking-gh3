import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { revokeTrustedNumber } from '@/lib/trusted-payment-numbers'
import { normalizeMsisdn } from '@/lib/payment-otp'

/**
 * Admin view over the Hubtel "verify once" trust store.
 *
 * Trust never expires on its own, so DELETE here is the only remedy if a number is
 * abused — after revoking, the next payment from it requires a fresh code.
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

/** GET /api/admin/trusted-numbers?search=&limit= */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if (auth.error) return auth.error

        const { searchParams } = new URL(request.url)
        const search = (searchParams.get('search') || '').replace(/\D/g, '')
        const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500)

        const db = createServerClient() as any
        let query = db
            .from('trusted_payment_numbers')
            .select('msisdn, verified_by, verified_at, last_used_at, payment_count, revoked_at')
            .order('verified_at', { ascending: false })
            .limit(limit)

        if (search) query = query.ilike('msisdn', `%${search}%`)

        const { data, error } = await query
        if (error) {
            console.error('[AdminTrustedNumbers] Query failed:', error.message)
            return NextResponse.json({ error: 'Could not load trusted numbers' }, { status: 500 })
        }

        return NextResponse.json({ success: true, numbers: data || [] })
    } catch (e) {
        console.error('[AdminTrustedNumbers] GET error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/** DELETE /api/admin/trusted-numbers   Body: { phone } */
export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if (auth.error) return auth.error

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const msisdn = normalizeMsisdn(body?.phone || '')
        if (!msisdn) {
            return NextResponse.json({ error: 'Enter a valid Ghana phone number.' }, { status: 400 })
        }

        const ok = await revokeTrustedNumber(msisdn)
        if (!ok) {
            return NextResponse.json({ error: 'Could not revoke this number.' }, { status: 500 })
        }

        console.log(`[AdminTrustedNumbers] ${auth.userId} revoked trust for ${msisdn}`)
        return NextResponse.json({
            success: true,
            message: 'Trust revoked. This number will need to verify again before its next payment.',
        })
    } catch (e) {
        console.error('[AdminTrustedNumbers] DELETE error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
