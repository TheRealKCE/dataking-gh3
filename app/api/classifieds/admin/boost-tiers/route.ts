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

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
        const { data, error } = await supabase
            .from('admin_settings')
            .select('key, value')
            .like('key', 'classifieds_boost_fee_%')

        if (error) throw error

        const settingsMap = (data || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = parseFloat(curr.value || '0')
            return acc
        }, {})

        const tiers = [
            { id: '7d', name: '1 Week', price: settingsMap['classifieds_boost_fee_7d'] || 0, duration_days: 7, description: 'Boost your listing for 7 days' },
            { id: '14d', name: '2 Weeks', price: settingsMap['classifieds_boost_fee_14d'] || 0, duration_days: 14, description: 'Boost your listing for 14 days' },
            { id: '21d', name: '3 Weeks', price: settingsMap['classifieds_boost_fee_21d'] || 0, duration_days: 21, description: 'Boost your listing for 21 days' },
            { id: '30d', name: '1 Month', price: settingsMap['classifieds_boost_fee_30d'] || 0, duration_days: 30, description: 'Boost your listing for 30 days' },
            { id: '60d', name: '2 Months', price: settingsMap['classifieds_boost_fee_60d'] || 0, duration_days: 60, description: 'Boost your listing for 60 days' },
            { id: '90d', name: '3 Months', price: settingsMap['classifieds_boost_fee_90d'] || 0, duration_days: 90, description: 'Boost your listing for 90 days' },
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

        const updates = tiers.map(tier => ({
            key: `classifieds_boost_fee_${tier.id}`,
            value: String(tier.price)
        }))

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
        const { error } = await supabase
            .from('admin_settings')
            .upsert(updates, { onConflict: 'key' })

        if (error) throw error

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
