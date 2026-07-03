import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyAdminAuth } from '@/lib/classifieds-auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

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
            return NextResponse.json({ error: 'Only admins can view stats' }, { status: 403 })
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

        // Get total listings count
        const { count: totalListings } = await supabase
            .from('classified_listings')
            .select('*', { count: 'exact', head: true })

        // Get active sellers (sellers with at least one active listing)
        const { data: activeSellersData } = await supabase
            .from('classified_listings')
            .select('seller_id')
            .eq('status', 'active')

        const activeSellers = new Set(activeSellersData?.map(l => l.seller_id) || []).size

        // Get boosts this month
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const { count: boostsThisMonth } = await supabase
            .from('classified_boosts')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart)

        // Get revenue from boosts this month
        const { data: boostData } = await supabase
            .from('classified_boosts')
            .select('amount_paid')
            .gte('created_at', monthStart)

        const revenue = boostData?.reduce((sum, b) => sum + (b.amount_paid || 0), 0) || 0

        return NextResponse.json({
            totalListings: totalListings || 0,
            activeSellers,
            boostsThisMonth: boostsThisMonth || 0,
            revenue,
        })
    } catch (error: any) {
        console.error('Stats API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch stats' },
            { status: 500 }
        )
    }
}
