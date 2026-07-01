import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
        const searchParams = request.nextUrl.searchParams

        const category_id = searchParams.get('category_id') || undefined
        const location = searchParams.get('location') || undefined
        const limit = parseInt(searchParams.get('limit') || '40')
        const now = new Date().toISOString()

        let query = supabase
            .from('classified_listings')
            .select('*, classified_categories(name, slug), classified_listing_images(id, storage_path, display_order)')
            .eq('status', 'active')
            .eq('is_boosted', true)
            .gt('boosted_until', now)

        if (category_id) {
            query = query.eq('category_id', category_id)
        }

        if (location) {
            query = query.ilike('location', `%${location}%`)
        }

        const { data, error } = await query
            .order('boosted_until', { ascending: false })
            .limit(limit)

        if (error) throw error

        return NextResponse.json({
            promoted_listings: data || [],
            count: (data || []).length,
        })
    } catch (error: any) {
        console.error('Promoted listings GET error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch promoted listings' },
            { status: 500 }
        )
    }
}
