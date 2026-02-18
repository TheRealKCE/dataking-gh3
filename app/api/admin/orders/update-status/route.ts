import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncShopOrderStatus } from '@/lib/shop-service'

// Create a service role client to bypass RLS for admin updates functions
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function POST(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Verify admin role
        const { data: user } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (!user || (user.role !== 'admin' && user.role !== 'sub-admin')) {
            return NextResponse.json(
                { error: 'Forbidden: Admin access required' },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { orderIds, status } = body

        if (!orderIds || !Array.isArray(orderIds) || !status) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            )
        }

        // Use service role client to update orders
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status })
            .in('id', orderIds)

        if (error) {
            console.error('Error updating orders:', error)
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            )
        }

        // Sync with shop_orders
        await Promise.all(orderIds.map(id => syncShopOrderStatus(id, status)))

        return NextResponse.json({ success: true, count: orderIds.length })
    } catch (error: any) {
        console.error('Error in update status route:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
