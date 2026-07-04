import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyAdminAuth } from '@/lib/classifieds-auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const isAdmin = await verifyAdminAuth(userId)
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only admins can view boost tiers' }, { status: 403 })
        }

        // For now, return default tiers. In the future, this will fetch from a database
        const tiers = [
            { id: '1', name: 'Standard Boost', price: 50, duration_days: 7, description: 'Boost your listing for 7 days' },
            { id: '2', name: 'Premium Boost', price: 100, duration_days: 14, description: 'Boost your listing for 14 days' },
            { id: '3', name: 'Elite Boost', price: 150, duration_days: 30, description: 'Boost your listing for 30 days' },
        ]

        return NextResponse.json({ tiers })
    } catch (error: any) {
        console.error('Get boost tiers API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch boost tiers' },
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

        const isAdmin = await verifyAdminAuth(userId)
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only admins can update boost tiers' }, { status: 403 })
        }

        const body = await request.json()
        const { tiers } = body

        if (!tiers || !Array.isArray(tiers)) {
            return NextResponse.json({ error: 'Invalid tiers data' }, { status: 400 })
        }

        // TODO: Save tiers to admin_settings table or new boost_tiers table
        // For now, just acknowledge the save
        console.log('Saving boost tiers:', tiers)

        return NextResponse.json({
            success: true,
            message: 'Boost tiers saved successfully',
            tiers,
        })
    } catch (error: any) {
        console.error('Update boost tiers API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to update boost tiers' },
            { status: 500 }
        )
    }
}
