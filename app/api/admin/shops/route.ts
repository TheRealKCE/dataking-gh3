import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminAccess } from '@/lib/auth-utils'

const ALLOWED_STATUSES = ['approved', 'rejected', 'suspended'] as const
type AllowedStatus = typeof ALLOWED_STATUSES[number]

export async function PATCH(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }
        const authUser = authResult.user!

        // 3. Parse and validate body
        const body = await request.json()
        const { shopId, status, note } = body

        if (!shopId) {
            return NextResponse.json({ error: 'shopId is required' }, { status: 400 })
        }

        if (!ALLOWED_STATUSES.includes(status as AllowedStatus)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` },
                { status: 400 }
            )
        }

        // 4. Use service role to bypass RLS
        const supabase = createServerClient()

        // 5. Guard against 0-row silent updates — verify shop exists first
        const { data: existing } = await (supabase as any)
            .from('shop_profiles')
            .select('id')
            .eq('id', shopId)
            .maybeSingle()

        if (!existing) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        // 6. Build update payload
        const now = new Date().toISOString()
        const updatePayload: Record<string, any> = {
            approval_status: status,
            approved_by: authUser.id,
            approved_at: now,
            updated_at: now,
        }

        if (note !== undefined && note !== null) {
            updatePayload.approval_note = note
        }

        if (status === 'approved') {
            // Allow owner to now configure pricing
            updatePayload.pricing_status = 'not_submitted'
        }

        if (status === 'rejected' || status === 'suspended') {
            updatePayload.is_active = false
        }

        // 7. Apply update
        const { error: updateError } = await (supabase as any)
            .from('shop_profiles')
            .update(updatePayload)
            .eq('id', shopId)

        if (updateError) throw updateError

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[AdminShops API]', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
