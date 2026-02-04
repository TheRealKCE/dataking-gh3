import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const available = searchParams.get('available') === 'true'
        const batchId = searchParams.get('batchId')
        const batchIds = searchParams.get('batchIds')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        let query = supabase
            .from('orders')
            .select(`
                *,
                users (
                    first_name,
                    last_name,
                    email
                )
            `)

        if (batchIds) {
            query = query.in('download_batch_id', batchIds.split(','))
        } else if (batchId) {
            query = query.eq('download_batch_id', batchId)
        } else if (available) {
            query = query.is('download_batch_id', null).eq('status', 'pending')
        }

        const { data: orders, error: fetchError } = await query.order('created_at', { ascending: false }).limit(200)

        if (fetchError) {
            console.error('[AdminOrdersFetch] Error:', fetchError)
            throw fetchError
        }

        // Fallback for missing cost_price (for older orders)
        if (orders && (orders as any[]).length > 0) {
            const ordersArray = orders as any[]
            // Check if any orders are missing cost_price
            const missingCost = ordersArray.some(o => !(o as any).cost_price || (o as any).cost_price === 0)

            if (missingCost) {
                // Fetch all available data packages to match cost_price
                const { data: packages } = await supabase
                    .from('data_packages')
                    .select('network, size, cost_price')

                if (packages) {
                    const packagesArray = packages as any[]
                    ordersArray.forEach(order => {
                        if (!(order as any).cost_price || (order as any).cost_price === 0) {
                            const matchedPkg = packagesArray.find(p => p.network === order.network && p.size === order.size)
                            if (matchedPkg) {
                                (order as any).cost_price = matchedPkg.cost_price
                            }
                        }
                    })
                }
            }
        }

        return NextResponse.json(orders)
    } catch (error: any) {
        console.error('Admin Orders Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
