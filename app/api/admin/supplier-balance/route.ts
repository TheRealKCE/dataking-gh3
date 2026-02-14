import { NextResponse } from 'next/server'
import { fetchSupplierBalance } from '@/lib/mtn-fulfillment'
import { createServerClient } from '@/lib/supabase-server'

export async function GET() {
    try {
        // Check admin authorization
        const supabase = createServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: dbUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (dbUser?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        // Fetch supplier balance
        const result = await fetchSupplierBalance()

        if (!result.success) {
            return NextResponse.json({
                error: result.error
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            balance: result.balance,
            currency: result.currency || 'GHS'
        })

    } catch (error: any) {
        return NextResponse.json({
            error: error.message
        }, { status: 500 })
    }
}
