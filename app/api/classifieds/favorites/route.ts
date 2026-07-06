import { NextRequest, NextResponse } from 'next/server'
import { getUserFavorites, toggleFavorite } from '@/lib/classifieds-queries'
import { verifyAuth } from '@/lib/classifieds-auth'

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const favorites = await getUserFavorites(userId)
        return NextResponse.json({ favorites })
    } catch (error: any) {
        console.error('Favorites GET error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch favorites' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { listing_id } = body

        if (!listing_id) {
            return NextResponse.json(
                { error: 'Missing listing_id' },
                { status: 400 }
            )
        }

        await toggleFavorite(userId, listing_id, 'add')
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Favorites POST error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to add favorite' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const listing_id = searchParams.get('listing_id')

        if (!listing_id) {
            return NextResponse.json(
                { error: 'Missing listing_id' },
                { status: 400 }
            )
        }

        await toggleFavorite(userId, listing_id, 'remove')
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Favorites DELETE error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to remove favorite' },
            { status: 500 }
        )
    }
}
