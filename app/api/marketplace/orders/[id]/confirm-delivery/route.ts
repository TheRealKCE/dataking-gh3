import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function POST(
    request: NextRequest,
    { params: { id } }: { params: { id: string } }
) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()

        const {
            data: { user },
        } = await supabaseUserClient.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get order
        const { data: order, error: orderError } = await supabaseUserClient
            .from('marketplace_orders')
            .select('*')
            .eq('id', id)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // Verify user is buyer
        if (order.buyer_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Check order status - can only confirm after shipped
        if (!['shipped', 'paid_escrowed'].includes(order.status)) {
            return NextResponse.json(
                { error: 'Order cannot be confirmed in current status' },
                { status: 400 }
            )
        }

        const now = new Date().toISOString()
        const newStatus =
            order.payment_mode === 'escrow'
                ? 'delivered_confirmed'
                : 'delivered_confirmed'

        // Update order status
        const { error: updateError } = await supabaseUserClient
            .from('marketplace_orders')
            .update({
                status: newStatus,
                delivered_at: now,
            })
            .eq('id', id)

        if (updateError) {
            console.error('[Confirm Delivery] Update error:', updateError)
            return NextResponse.json(
                { error: 'Failed to confirm delivery' },
                { status: 500 }
            )
        }

        // Log event
        await supabaseUserClient.from('marketplace_order_events').insert({
            order_id: id,
            event_type: 'delivery_confirmed',
            previous_status: order.status,
            new_status: newStatus,
            actor_id: user.id,
            notes: 'Buyer confirmed delivery',
        })

        // If escrow mode, funds can now be released
        if (order.payment_mode === 'escrow') {
            // Release funds to seller
            const { error: releaseError } = await supabaseUserClient
                .from('marketplace_escrow')
                .update({
                    status: 'released',
                    released_at: now,
                    reason_if_released: 'Delivery confirmed by buyer',
                })
                .eq('order_id', id)

            if (releaseError) {
                console.error('[Confirm Delivery] Release error:', releaseError)
            }

            // Update order to released
            await supabaseUserClient
                .from('marketplace_orders')
                .update({ status: 'released' })
                .eq('id', id)

            // Log release event
            await supabaseUserClient.from('marketplace_order_events').insert({
                order_id: id,
                event_type: 'released',
                previous_status: newStatus,
                new_status: 'released',
                actor_id: user.id,
                notes: 'Escrow funds released to seller',
            })
        }

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                status: newStatus,
                delivered_at: now,
            },
        })
    } catch (error) {
        console.error('[Confirm Delivery] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
