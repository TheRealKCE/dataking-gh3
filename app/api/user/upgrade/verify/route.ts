import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { processCompletedUpgradePayment } from '@/lib/payments'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function GET(request: NextRequest) {
    try {
        // 1. Auth check
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore as any })
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Get reference from URL
        const { searchParams } = new URL(request.url)
        const reference = searchParams.get('reference') || searchParams.get('trxref')

        if (!reference) {
            return NextResponse.json({ success: false, error: 'No reference provided' }, { status: 400 })
        }

        // 3. Only handle agent_upgrade references
        if (!reference.startsWith('agent_upgrade_')) {
            return NextResponse.json({ success: false, error: 'Not an upgrade reference' }, { status: 400 })
        }

        // 4. Verify with Paystack directly
        const paystackResponse = await fetch(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                },
            }
        )

        const paystackData = await paystackResponse.json()

        if (!paystackData.status || paystackData.data?.status !== 'success') {
            console.error('[UpgradeVerify] Paystack verification failed:', paystackData)
            return NextResponse.json({ success: false, error: 'Payment not confirmed by Paystack' }, { status: 400 })
        }

        // 5. Process the upgrade (idempotent — safe to call even if webhook already ran)
        const result = await processCompletedUpgradePayment(reference, paystackData.data)

        if (!result.success && !result.alreadyProcessed) {
            console.error('[UpgradeVerify] Processing failed:', result.error)
            return NextResponse.json({ success: false, error: result.error || 'Processing failed' }, { status: 500 })
        }

        return NextResponse.json({ success: true, alreadyProcessed: !!result.alreadyProcessed })

    } catch (error: any) {
        console.error('[UpgradeVerify] Error:', error)
        return NextResponse.json({ success: false, error: error.message || 'Verification failed' }, { status: 500 })
    }
}
