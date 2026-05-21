import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteClient()
        
        // Ensure user is authenticated
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Use the admin client to bypass RLS on results_checker_inventory
        const adminSupabase = createServerClient()
        
        const { data, error } = await adminSupabase
            .from('results_checker_orders')
            .select('*, results_checker_inventory(pin, serial_number)')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[VouchersHistory] DB Error:', error)
            return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        console.error('[VouchersHistory] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
