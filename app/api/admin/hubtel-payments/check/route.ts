import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { checkCommissionStatus } from '@/lib/hubtel-payment-service'
import { logStatusCheck } from '@/lib/hubtel-payment-log'

/**
 * Asks Hubtel what became of one transaction, and finds the order it belongs to.
 *
 * This is the step /admin/utilities and /admin/airtime have always assumed happened
 * somewhere else. Their PATCH docs say the admin "confirmed it in the Hubtel portal"
 * before choosing complete / refund / fail — leaving the app, hunting the
 * transaction, coming back and acting from memory. The Commission Services sweeps
 * (/api/cron/sync-hubtel-{airtime,utility}) refuse to guess for the same reason and
 * just page a human.
 *
 * So this route only ANSWERS. It resolves the order and says what the answer implies,
 * but changes nothing: applying it goes through the existing PATCH endpoints, which
 * own the refund and completion logic and the customer notification. A bill payment
 * cannot be recalled, so the decision stays with a person.
 */

async function requireAdmin() {
    const supabase = await createRouteHandlerClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const db = createServerClient()
    const { data: userData } = await db
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

    if ((userData as any)?.role !== 'admin') {
        return { error: NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 }) }
    }
    return { userId: authUser.id }
}

/**
 * Finds the order a Commission Services reference belongs to.
 *
 * Both sides key on client_reference and both are UNIQUE, so this is an exact match,
 * never a guess: 'UTLB-' rows live on utility_orders, 'AIR-' rows on
 * airtime_fulfillment_legs which carry the order_id.
 */
async function findLinkedOrder(db: any, clientReference: string) {
    if (clientReference.startsWith('UTLB-')) {
        const { data } = await db
            .from('utility_orders')
            .select('id, reference_code, service, account_number, account_name, status, payment_status, total_paid, bill_amount, created_at')
            .eq('client_reference', clientReference)
            .maybeSingle()
        if (!data) return null
        return {
            kind: 'utility' as const,
            id: data.id,
            reference: data.reference_code,
            status: data.status,
            amount: Number(data.bill_amount),
            createdAt: data.created_at,
            description: `${String(data.service || '').toUpperCase()} · ${data.account_number}${data.account_name ? ` · ${data.account_name}` : ''}`,
        }
    }

    if (clientReference.startsWith('AIR-')) {
        const { data: leg } = await db
            .from('airtime_fulfillment_legs')
            .select('id, order_id, leg_index, amount, status, created_at')
            .eq('client_reference', clientReference)
            .maybeSingle()
        if (!leg) return null

        const { data: order } = await db
            .from('airtime_orders')
            .select('id, reference_code, network, beneficiary_phone, status, airtime_amount')
            .eq('id', leg.order_id)
            .maybeSingle()
        if (!order) return null

        return {
            kind: 'airtime' as const,
            id: order.id,
            reference: order.reference_code,
            status: order.status,
            // The leg's amount, not the order's: a top-up over GHS 100 is split, so
            // Hubtel answered about this slice rather than the whole purchase.
            amount: Number(leg.amount),
            createdAt: leg.created_at,
            description: `${order.network} · ${order.beneficiary_phone} · leg ${leg.leg_index} of GHS ${Number(order.airtime_amount)} (${leg.status})`,
        }
    }

    return null
}

/**
 * What the admin should probably do, given Hubtel's answer.
 *
 * A suggestion, never an instruction — and deliberately empty when Hubtel is unsure.
 * 'Unpaid' from a status endpoint that may not even cover this account is not proof
 * the bill went unpaid, and refunding on that basis is how a paid bill gets paid
 * twice. Uncertainty has to survive the round trip.
 */
function suggestAction(hubtelStatus: string | null, kind: 'utility' | 'airtime' | null) {
    if (!kind || !hubtelStatus) return null
    const s = hubtelStatus.toLowerCase()

    if (['paid', 'success', 'successful', 'completed'].includes(s)) {
        return kind === 'utility'
            ? { action: 'complete', label: 'Mark order completed', tone: 'success' as const }
            : { action: 'completed', label: 'Mark order completed', tone: 'success' as const }
    }

    if (['failed', 'rejected', 'declined', 'refunded', 'reversed'].includes(s)) {
        return kind === 'utility'
            ? { action: 'refund', label: 'Fail order and refund the customer', tone: 'danger' as const }
            : { action: 'failed', label: 'Mark order failed', tone: 'danger' as const }
    }

    return null
}

/** POST /api/admin/hubtel-payments/check  { clientReference } */
export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if (auth.error) return auth.error

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const clientReference = String(body?.clientReference ?? '').trim()
        if (!clientReference) {
            return NextResponse.json({ error: 'A reference is required' }, { status: 400 })
        }

        const hubtel = await checkCommissionStatus(clientReference)

        // Record the lookup on the same row the initiate and callback write to. The
        // 'status_check' stage already exists for exactly this. Fail-open like every
        // other write in that module — a log must not break the answer.
        await logStatusCheck({
            clientReference,
            status: hubtel.success
                ? (['paid', 'success', 'successful', 'completed'].includes(String(hubtel.status).toLowerCase()) ? 'success' : 'failed')
                : 'pending',
            hubtelStatus: hubtel.status,
            transactionId: hubtel.transactionId ?? null,
            amount: hubtel.amount ?? null,
            message: hubtel.success
                ? `Admin check via ${hubtel.accountUsed} account: ${hubtel.status}`
                : `Admin check found no answer: ${hubtel.error}`,
            raw: hubtel.raw ?? hubtel.attempts,
        }).catch(() => {})

        const db = createServerClient() as any
        const linkedOrder = await findLinkedOrder(db, clientReference)

        return NextResponse.json({
            clientReference,
            hubtel: {
                answered: hubtel.success,
                status: hubtel.status,
                accountUsed: hubtel.accountUsed,
                transactionId: hubtel.transactionId ?? null,
                externalTransactionId: hubtel.externalTransactionId ?? null,
                amount: hubtel.amount ?? null,
                charges: hubtel.charges ?? null,
                date: hubtel.date ?? null,
                error: hubtel.error ?? null,
                attempts: hubtel.attempts,
                raw: hubtel.raw ?? null,
            },
            linkedOrder,
            suggestion: suggestAction(hubtel.success ? hubtel.status : null, linkedOrder?.kind ?? null),
        })
    } catch (error) {
        console.error('[HubtelCheck] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
