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

        // Check order status
        if (order.status !== 'created') {
            return NextResponse.json(
                { error: 'Order cannot be paid in current status' },
                { status: 400 }
            )
        }

        // For now, we'll simulate payment success
        // In production, this would integrate with a payment gateway
        const now = new Date().toISOString()

        // Update order status
        const { error: updateError } = await supabaseUserClient
            .from('marketplace_orders')
            .update({
                status: order.payment_mode === 'escrow' ? 'paid_escrowed' : 'paid',
                paid_at: now,
            })
            .eq('id', id)

        if (updateError) {
            console.error('[Pay Order] Update error:', updateError)
            return NextResponse.json(
                { error: 'Failed to process payment' },
                { status: 500 }
            )
        }

        // Create payment transaction
        const { error: txError } = await supabaseUserClient
            .from('marketplace_payment_transactions')
            .insert({
                order_id: id,
                payer_id: user.id,
                payee_id: order.seller_id,
                amount_pesewas: order.total_price_pesewas,
                payment_method: 'wallet', // Default to wallet for MVP
                status: 'completed',
                completed_at: now,
                metadata: { payment_mode: order.payment_mode },
            })

        if (txError) {
            console.error('[Pay Order] Transaction error:', txError)
        }

        // If escrow mode, create escrow account
        if (order.payment_mode === 'escrow') {
            await supabaseUserClient.from('marketplace_escrow').insert({
                buyer_id: user.id,
                order_id: id,
                amount_pesewas: order.total_price_pesewas,
                status: 'held',
            })
        }

        // Log event
        await supabaseUserClient.from('marketplace_order_events').insert({
            order_id: id,
            event_type: 'paid',
            previous_status: 'created',
            new_status: order.payment_mode === 'escrow' ? 'paid_escrowed' : 'paid',
            actor_id: user.id,
            notes: `Payment received via ${order.payment_mode}`,
        })

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                status: order.payment_mode === 'escrow' ? 'paid_escrowed' : 'paid',
                paid_at: now,
            },
        })
    } catch (error) {
        console.error('[Pay Order] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
