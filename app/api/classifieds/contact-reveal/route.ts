import { NextRequest, NextResponse } from 'next/server'
import { getListingById, recordContactReveal } from '@/lib/classifieds-queries'
import { verifyAuth } from '@/lib/classifieds-auth'

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const buyerId = await verifyAuth(token)

        if (!buyerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { listing_id, acknowledged_safety_tips } = body

        if (!listing_id) {
            return NextResponse.json(
                { error: 'Missing listing_id' },
                { status: 400 }
            )
        }

        if (!acknowledged_safety_tips) {
            return NextResponse.json(
                { error: 'Must acknowledge safety tips' },
                { status: 400 }
            )
        }

        const listing = await getListingById(listing_id)
        if (!listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        await recordContactReveal(listing_id, buyerId, acknowledged_safety_tips)

        return NextResponse.json({
            seller_name: listing.users?.first_name,
            phone: listing.contact_phone,
            email: listing.contact_email,
            location: listing.location,
            whatsapp_number: listing.whatsapp_number,
            facebook_url: listing.facebook_url,
            twitter_url: listing.twitter_url,
            instagram_url: listing.instagram_url,
        })
    } catch (error: any) {
        console.error('Contact reveal error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to reveal contact' },
            { status: 500 }
        )
    }
}
