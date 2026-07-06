import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin/sub-admin role
        const { data: userRole } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userRole?.role !== 'admin' && userRole?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { listing_id, action, reason, feedback } = body

        if (!listing_id || !action) {
            return NextResponse.json(
                { error: 'Missing listing_id or action' },
                { status: 400 }
            )
        }

        // Fetch current listing
        const { data: listing, error: fetchError } = await supabaseUserClient
            .from('classified_listings')
            .select('moderation_status')
            .eq('id', listing_id)
            .single()

        if (fetchError || !listing) {
            return NextResponse.json(
                { error: 'Listing not found' },
                { status: 404 }
            )
        }

        const previousStatus = listing.moderation_status
        const newStatus = action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : previousStatus

        // Update listing
        const { error: updateError } = await supabaseUserClient
            .from('classified_listings')
            .update({
                moderation_status: newStatus,
                rejection_reason: reason,
                rejection_feedback: feedback,
                moderated_at: new Date().toISOString(),
                moderated_by: authUser.id,
            })
            .eq('id', listing_id)

        if (updateError) {
            console.error('[ModerationAction] Update error:', updateError)
            return NextResponse.json(
                { error: 'Failed to update listing' },
                { status: 500 }
            )
        }

        // Log action
        const { error: logError } = await supabaseUserClient
            .from('marketplace_moderation_actions')
            .insert({
                listing_id,
                action,
                previous_status: previousStatus,
                new_status: newStatus,
                admin_id: authUser.id,
                reason,
                feedback,
            })

        if (logError) {
            console.error('[ModerationAction] Log error:', logError)
        }

        // Send notification to seller
        if (action === 'approved' || action === 'rejected') {
            // TODO: Send email notification to seller
        }

        return NextResponse.json({
            success: true,
            listing_id,
            action,
            new_status,
        })
    } catch (error) {
        console.error('[ModerationAction] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
