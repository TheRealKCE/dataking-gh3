import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchKingFlexyDeliveryStatuses } from '@/lib/kingflexy-sms-service'

/**
 * KingFlexy SMS delivery reports.
 *
 * Register as: https://arhmsgh.com/api/webhooks/kingflexy-sms?secret=<KINGFLEXY_SMS_WEBHOOK_SECRET>
 * — the apex domain, never www, because a cross-host 307 drops the query string
 * and the body along with it.
 *
 * Until this fires, a sent message sits at 'sent' forever: Moolre and Hubtel
 * never told us what happened after handoff. This is the first delivery truth
 * the campaign screens have had.
 *
 * Their published payload shape is not documented beyond "a signed POST", so
 * this accepts the plausible shapes and, when the body carries only a campaign
 * id, goes and fetches the per-recipient rows itself. That makes it correct
 * whichever shape actually arrives.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

/** Their vocabulary is already ours; anything unknown is left alone. */
const KNOWN_STATUSES = new Set(['queued', 'sent', 'delivered', 'undelivered', 'failed', 'expired', 'rejected'])

/**
 * Refundable outcomes: the message was refused, so it never reached anyone.
 *
 * 'undelivered' and 'expired' are NOT refunded — the network accepted and
 * carried the message, and a handset that was off or full is not the provider
 * failing to deliver a paid-for send.
 */
const REFUNDABLE = new Set(['failed', 'rejected'])

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.KINGFLEXY_SMS_WEBHOOK_SECRET
        if (!secret) {
            console.error('[KingFlexySmsWebhook] KINGFLEXY_SMS_WEBHOOK_SECRET is not set; refusing to trust this call.')
            return NextResponse.json({ error: 'Not configured' }, { status: 503 })
        }

        // Accepted in the query string or a header: the query string is what
        // their dashboard's single URL field can carry.
        const provided = new URL(request.url).searchParams.get('secret')
            || request.headers.get('x-webhook-secret')
            || ''
        if (provided !== secret) {
            console.error('[KingFlexySmsWebhook] Rejected a call with a bad or missing secret.')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body: any = await request.json().catch(() => ({}))
        const payload = body?.data ?? body ?? {}
        const providerCampaignId = String(payload.campaignId || payload.campaign_id || payload.id || '')

        if (!providerCampaignId) {
            console.error('[KingFlexySmsWebhook] No campaign id in payload:', JSON.stringify(body).slice(0, 400))
            // 200 on purpose: a retry would carry the same unusable body.
            return NextResponse.json({ success: true, ignored: 'no campaign id' })
        }

        // Rows carry their campaign id from the bulk send.
        const { data: ourMessages } = await supabaseAdmin
            .from('sms_messages')
            .select('id, campaign_id, account_id, recipient, status')
            .eq('provider_message_id', providerCampaignId)
            .limit(10_000)

        const rows = (ourMessages || []) as { id: string; campaign_id: string; account_id: string; recipient: string; status: string }[]
        if (!rows.length) {
            console.error('[KingFlexySmsWebhook] No messages match provider campaign', providerCampaignId)
            return NextResponse.json({ success: true, ignored: 'unknown campaign' })
        }

        // Prefer statuses in the body; fall back to asking them. Either way the
        // map is keyed by the 233… number our rows are stored in.
        const incoming = new Map<string, string>()
        const bodyRows: any[] = Array.isArray(payload.messages) ? payload.messages
            : Array.isArray(payload.recipients) ? payload.recipients
                : []

        for (const row of bodyRows) {
            const recipient = String(row?.recipient || row?.phone || row?.msisdn || '')
            const status = String(row?.status || '').toLowerCase()
            if (recipient && KNOWN_STATUSES.has(status)) incoming.set(recipient, status)
        }

        // A single-recipient report, or a campaign-level one with a status.
        if (!incoming.size && payload.recipient && payload.status) {
            const status = String(payload.status).toLowerCase()
            if (KNOWN_STATUSES.has(status)) incoming.set(String(payload.recipient), status)
        }

        if (!incoming.size) {
            for (const [recipient, status] of await fetchKingFlexyDeliveryStatuses(providerCampaignId)) {
                if (KNOWN_STATUSES.has(status)) incoming.set(recipient, status)
            }
        }

        if (!incoming.size) {
            return NextResponse.json({ success: true, ignored: 'no statuses' })
        }

        const now = new Date().toISOString()
        let updated = 0
        let refunded = 0
        const touchedCampaigns = new Set<string>()

        for (const row of rows) {
            const status = incoming.get(row.recipient)
            if (!status || status === row.status) continue

            // Only ever move forward. A late 'sent' report arriving after
            // 'delivered' must not walk the row backwards.
            if (row.status === 'delivered' && status !== 'undelivered') continue
            if (row.status === 'failed' || row.status === 'rejected') continue

            await supabaseAdmin.from('sms_messages').update({
                status,
                status_updated_at: now,
            }).eq('id', row.id)
            updated++
            touchedCampaigns.add(row.campaign_id)

            if (REFUNDABLE.has(status)) {
                const { data: campaign } = await supabaseAdmin
                    .from('sms_campaigns')
                    .select('segments')
                    .eq('id', row.campaign_id)
                    .maybeSingle()

                const { error: refundError } = await (supabaseAdmin as any).rpc('credit_sms_credits', {
                    p_account_id: row.account_id,
                    p_amount: (campaign as any)?.segments || 1,
                    p_purchased: false,
                })
                if (refundError) console.error('[KingFlexySmsWebhook] CRITICAL: refund failed for message', row.id, refundError)
                else refunded++
            }
        }

        // A campaign left 'processing' because its last messages were still in
        // flight can now be closed out.
        for (const campaignId of touchedCampaigns) {
            const { settleCampaignIfDone } = await import('@/lib/sms/customer-sms')
            await settleCampaignIfDone(supabaseAdmin, campaignId)
        }

        console.log(`[KingFlexySmsWebhook] ${providerCampaignId}: ${updated} updated, ${refunded} refunded`)
        return NextResponse.json({ success: true, updated, refunded })
    } catch (error: any) {
        console.error('[KingFlexySmsWebhook] Error:', error)
        return NextResponse.json({ error: error.message || 'Webhook failed' }, { status: 500 })
    }
}
