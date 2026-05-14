import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { processCompletedUpgradePayment } from '@/lib/payments'
import { checkPaymentStatus } from '@/lib/moolre-payment-service'
import { createServerClient } from '@/lib/supabase'

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

        // 4. Verify with Moolre directly
        const moolreResponse = await checkPaymentStatus(reference)

        if (!moolreResponse.success || moolreResponse.txstatus === null) {
            console.error('[UpgradeVerify] Moolre verification failed:', moolreResponse.error)
            return NextResponse.json({ success: true, status: 'pending', error: 'Payment check failed temporarily' })
        }

        if (moolreResponse.txstatus === 0 || moolreResponse.txstatus === 3) {
            return NextResponse.json({ success: true, status: 'pending' })
        }

        if (moolreResponse.txstatus === 2) {
            return NextResponse.json({ success: false, status: 'failed' })
        }

        // Moolre doesn't return metadata, we fetch it from the database
        const supabaseServer = createServerClient()
        const { data: payment } = await supabaseServer
            .from('wallet_payments')
            .select('total_amount, metadata')
            .eq('reference', reference)
            .single()

        if (!payment) {
            console.error('[UpgradeVerify] Payment not found in database:', reference)
            return NextResponse.json({ success: false, status: 'failed', error: 'Payment record not found' }, { status: 400 })
        }

        const metadata = (payment as any).metadata || {}
        const paidAmountKobo = Math.round(Number((payment as any).total_amount) * 100)

        const mappedEventData = {
            reference: reference,
            amount: paidAmountKobo,
            metadata: metadata
        }

        // 5. Process the upgrade (idempotent — safe to call even if webhook already ran)
        const result = await processCompletedUpgradePayment(reference, mappedEventData)

        if (!result.success && !result.alreadyProcessed) {
            console.error('[UpgradeVerify] Processing failed:', result.error)
            return NextResponse.json({ success: false, status: 'failed', error: result.error || 'Processing failed' }, { status: 500 })
        }

        return NextResponse.json({ success: true, status: 'completed', alreadyProcessed: !!result.alreadyProcessed })

    } catch (error: any) {
        console.error('[UpgradeVerify] Error:', error)
        return NextResponse.json({ success: false, error: error.message || 'Verification failed' }, { status: 500 })
    }
}
