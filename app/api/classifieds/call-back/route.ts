import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/classifieds-auth'
import { createServerClient } from '@/lib/supabase'
import { createNotification } from '@/lib/notification-service'

// POST /api/classifieds/call-back
// A buyer requests a call back on a listing. Notifies the seller (in-app
// notification) with the buyer's name, phone and an optional note.
export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const userId = await verifyAuth(token)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const listingId: string | undefined = body?.listing_id
        const note: string | undefined = body?.note

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
        if (listing.seller_id === userId) {
            return NextResponse.json(
                { error: 'You cannot request a call back on your own listing' },
                { status: 400 }
            )
        }

        const { data: buyer } = await (supabase.from('users') as any)
            .select('first_name, last_name, phone_number')
            .eq('id', userId)
            .single()

        const buyerName =
            [buyer?.first_name, buyer?.last_name].filter(Boolean).join(' ') || 'A buyer'
        const phone = buyer?.phone_number || 'no phone on file'
        const noteText = note ? ` Note: "${String(note).slice(0, 300)}"` : ''

        await createNotification({
            userId: listing.seller_id,
            title: 'Call back request',
            message: `${buyerName} (${phone}) requested a call back about "${listing.title}".${noteText}`,
            type: 'system',
            actionUrl: `/classifieds/${listingId}`,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Call-back request error:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to send call back request' },
            { status: 500 }
        )
    }
}
