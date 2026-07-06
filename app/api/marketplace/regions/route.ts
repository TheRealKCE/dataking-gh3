import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Public reference data for the marketplace (Ghana regions + cities).
// Served from a route handler so client components never import the
// service-role query module (which would crash in the browser — the
// service client reads env via dynamic process.env[...] that Next.js
// does not inline client-side).
//
//   GET /api/marketplace/regions              -> all regions
//   GET /api/marketplace/regions?regionId=ID  -> cities in that region
export async function GET(request: NextRequest) {
    try {
        const supabase = createServerClient()
        const regionId = request.nextUrl.searchParams.get('regionId')

        if (regionId) {
            const { data, error } = await supabase
                .from('marketplace_ghana_cities')
                .select('*')
                .eq('region_id', regionId)
                .order('city_name', { ascending: true })

            if (error) throw error
            return NextResponse.json(data || [])
        }

        const { data, error } = await supabase
            .from('marketplace_ghana_regions')
            .select('*')
            .order('region_name', { ascending: true })

        if (error) throw error
        return NextResponse.json(data || [])
    } catch (err: any) {
        console.error('[api/marketplace/regions] error:', err?.message || err)
        return NextResponse.json([], { status: 200 })
    }
}
