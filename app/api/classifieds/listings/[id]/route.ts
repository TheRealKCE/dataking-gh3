import { NextRequest, NextResponse } from 'next/server'
import { getListingById, updateListing, deleteListing, incrementViewCount } from '@/lib/classifieds-queries'
import { verifyAuth, verifyAdminAuth } from '@/lib/classifieds-auth'

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const listing = await getListingById(params.id)

        if (!listing) {
            return NextResponse.json(
                { error: 'Listing not found' },
                { status: 404 }
            )
        }

        if (listing.status !== 'active') {
            const authHeader = request.headers.get('authorization')
            const token = authHeader?.replace('Bearer ', '')
            const userId = await verifyAuth(token)

            if (userId !== listing.seller_id) {
                const isAdmin = await verifyAdminAuth(userId)
                if (!isAdmin) {
                    return NextResponse.json(
                        { error: 'Listing not found' },
                        { status: 404 }
                    )
                }
            }
        }

        await incrementViewCount(params.id)

        return NextResponse.json(listing)
    } catch (error: any) {
        console.error('Listing detail GET error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch listing' },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const listing = await getListingById(params.id)
        if (!listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        const isAdmin = await verifyAdminAuth(userId)
        if (userId !== listing.seller_id && !isAdmin) {
            return NextResponse.json(
                { error: 'You can only edit your own listings' },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { title, description, price, location, condition, status, expires_at } = body

        const updatedListing = await updateListing(params.id, {
            ...(title && { title }),
            ...(description && { description }),
            ...(price !== undefined && { price }),
            ...(location !== undefined && { location }),
            ...(condition && { condition }),
            ...(status && { status }),
            ...(expires_at !== undefined && { expires_at }),
        })

        return NextResponse.json(updatedListing)
    } catch (error: any) {
        console.error('Listing PUT error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to update listing' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const listing = await getListingById(params.id)
        if (!listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        const isAdmin = await verifyAdminAuth(userId)
        if (userId !== listing.seller_id && !isAdmin) {
            return NextResponse.json(
                { error: 'You can only delete your own listings' },
                { status: 403 }
            )
        }

        await deleteListing(params.id)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Listing DELETE error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to delete listing' },
            { status: 500 }
        )
    }
}
