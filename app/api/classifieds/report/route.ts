import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/classifieds-auth'
import { createServerClient } from '@/lib/supabase'
import { notifyAllAdmins } from '@/lib/notification-service'

const REASONS = new Set([
    'scam',
    'prohibited',
    'duplicate',
    'wrong_category',
    'offensive',
    'already_sold',
    'other',
])

// POST /api/classifieds/report
// A viewer reports a listing. Notifies all admins for moderation review.
export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const userId = await verifyAuth(token)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const listingId: string | undefined = body?.listing_id
        const reason: string = REASONS.has(body?.reason) ? body.reason : 'other'
        const details: string | undefined = body?.details

        if (!listingId) {
            return NextResponse.json({ error: 'Missing listing_id' }, { status: 400 })
        }

        const supabase = createServerClient()

        const { data: listing } = await (supabase.from('classified_listings') as any)
            .select('id, title, seller_id')
            .eq('id', listingId)
            .single()

        if (!listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        const { data: reporter } = await (supabase.from('users') as any)
            .select('first_name, last_name')
            .eq('id', userId)
            .single()

        const reporterName =
            [reporter?.first_name, reporter?.last_name].filter(Boolean).join(' ') || 'A user'
        const reasonLabel = reason.replace(/_/g, ' ')
        const detailText = details ? ` — "${String(details).slice(0, 500)}"` : ''

        await notifyAllAdmins({
            title: 'Listing reported',
            message: `${reporterName} reported "${listing.title}" for ${reasonLabel}.${detailText}`,
            type: 'system',
            actionUrl: `/classifieds/${listingId}`,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Report listing error:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to submit report' },
            { status: 500 }
        )
    }
}
