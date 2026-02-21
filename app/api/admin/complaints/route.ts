import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const supabase = createServerClient()

        const { data, error } = await supabase
            .from('complaints')
            .select(`
                *,
                users (first_name, last_name, email),
                orders (reference_code, phone_number, network, size, shop_name, created_at)
            `)
            .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error fetching complaints:', error)
        return NextResponse.json(
            { error: 'Failed to fetch complaints' },
            { status: 500 }
        )
    }
}
