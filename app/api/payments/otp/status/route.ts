import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { normalizeMsisdn } from '@/lib/payment-otp'
import { isTrustedPaymentNumber } from '@/lib/trusted-payment-numbers'

/**
 * GET /api/payments/otp/status?phone=0541234567
 *
 * Tells the checkout whether the number the customer just typed still needs the
 * one-time verification, so the UI can show the right thing as they type instead
 * of making them submit and get refused.
 *
 * Read-only: sends nothing, changes nothing.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createRouteClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const msisdn = normalizeMsisdn(searchParams.get('phone') || '')
        if (!msisdn) {
            return NextResponse.json({ valid: false, needsVerification: false })
        }

        const admin = createServerClient()
        const { data: profile } = await (admin.from('users') as any)
            .select('phone_number')
            .eq('id', authUser.id)
            .single()

        const registered = normalizeMsisdn((profile as any)?.phone_number || '')
        const isRegistered = !!registered && registered === msisdn
        const trusted = isRegistered ? true : await isTrustedPaymentNumber(msisdn)

        return NextResponse.json({
            valid: true,
            isRegistered,
            trusted,
            needsVerification: !trusted,
        })
    } catch (e) {
        console.error('[PayOtpStatus] error:', e)
        // Fail closed: if we can't tell, ask for the code rather than assume trust.
        return NextResponse.json({ valid: true, isRegistered: false, trusted: false, needsVerification: true })
    }
}
