import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic' // Force Next.js not to cache this API route

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const keysParam = searchParams.get('keys')
        
        // Build the query
        let query = supabase.from('admin_settings').select('key, value')
        
        if (keysParam) {
            const keys = keysParam.split(',').map(k => k.trim())
            query = query.in('key', keys)
        }

        const { data, error } = await query

        if (error) {
            throw error
        }

        // Convert array of {key, value} to a flat object
        const settings = (data || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // Return with headers that explicitly forbid caching
        return NextResponse.json(settings, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        })
    } catch (error) {
        console.error('Error fetching admin settings:', error)
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        )
    }
}
