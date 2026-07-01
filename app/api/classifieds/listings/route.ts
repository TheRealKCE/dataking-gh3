import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getListingsWithPagination, createListing } from '@/lib/classifieds-queries'
import { verifyAuth, verifySellerAuth } from '@/lib/classifieds-auth'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams

        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const category_id = searchParams.get('category_id') || undefined
        const location = searchParams.get('location') || undefined
        const price_min = searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : undefined
        const price_max = searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : undefined
        const status = searchParams.get('status') || 'active'

        const result = await getListingsWithPagination({
            page,
            limit,
            category_id,
            location,
            price_min,
            price_max,
            status,
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Listings GET error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch listings' },
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

        const isSeller = await verifySellerAuth(userId)
        if (!isSeller) {
            return NextResponse.json(
                { error: 'Only sellers can create listings' },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { title, description, category_id, price, location, condition, contact_phone, contact_email, expires_at } = body

        if (!title || !description || !category_id || price === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: title, description, category_id, price' },
                { status: 400 }
            )
        }

        if (price < 0) {
            return NextResponse.json(
                { error: 'Price must be positive' },
                { status: 400 }
            )
        }

        const listing = await createListing(userId, {
            title,
            description,
            category_id,
            price,
            location: location || null,
            condition: condition || 'used',
            contact_phone: contact_phone || null,
            contact_email: contact_email || null,
            expires_at: expires_at || null,
        })

        return NextResponse.json(listing, { status: 201 })
    } catch (error: any) {
        console.error('Listings POST error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to create listing' },
            { status: 500 }
        )
    }
}
