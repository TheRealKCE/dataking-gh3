import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ shopId: string }> }
) {
    try {
        const { shopId } = await params
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })

        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify caller is admin
        const { data: callerUser } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (!callerUser || !['admin', 'sub-admin'].includes(callerUser.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (!shopId) {
            return NextResponse.json({ error: 'shopId is required' }, { status: 400 })
        }

        const body = await request.json()

        // Fee override parsing rule:
        // - null / undefined / "" → null → means "Inherit from Global Settings for this shop's owner role"
        // - 0                     → 0    → means "Deliberately free for this shop"
        // - any other number      → that exact value as an override
        const parseOverride = (val: any): number | null => {
            if (val === null || val === undefined || val === '') return null
            const parsed = parseFloat(String(val))
            return isNaN(parsed) ? null : parsed
        }

        const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
        }

        // Only apply fields that were actually sent in the request body
        if ('fulfillment_mode' in body)     updatePayload.fulfillment_mode      = body.fulfillment_mode
        if ('is_active' in body)            updatePayload.is_active             = body.is_active
        if ('paystack_fee_percent' in body)   updatePayload.paystack_fee_percent   = parseOverride(body.paystack_fee_percent)
        if ('withdrawal_fee_percent' in body) updatePayload.withdrawal_fee_percent = parseOverride(body.withdrawal_fee_percent)
        if ('withdrawal_fee_flat' in body)    updatePayload.withdrawal_fee_flat    = parseOverride(body.withdrawal_fee_flat)
        if ('min_withdrawal_amount' in body)  updatePayload.min_withdrawal_amount  = parseOverride(body.min_withdrawal_amount)

        // Use service role client — bypasses RLS and the security trigger.
        // This is safe because we have already verified the caller is an admin above.
        const supabase = createServerClient()
        const { error } = await (supabase as any)
            .from('shop_profiles')
            .update(updatePayload)
            .eq('id', shopId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[AdminShopSettings API]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
