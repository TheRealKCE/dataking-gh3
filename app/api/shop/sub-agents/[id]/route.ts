import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

/**
 * PATCH /api/shop/sub-agents/[id]
 * Lead approves or suspends a sub-agent
 *
 * Authorization: User must be the upline Lead OR an admin
 * Body: { action: 'approve' | 'suspend', note?: string }
 * Response: { success: true, sub: {...} }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { action, note } = await request.json()

    if (!['approve', 'suspend'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "suspend"' },
        { status: 400 }
      )
    }

    const supabaseAuth = await createRouteHandlerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase: any = createServerClient()

    // Get the sub-agent and verify authorization
    const { data: subAgent, error: fetchError } = await supabase
      .from('sub_agents')
      .select(`
        id,
        status,
        upline_shop_id,
        user_id,
        shop_profiles!upline_shop_id(
          owner_id
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !subAgent) {
      return NextResponse.json(
        { error: 'Sub-agent not found' },
        { status: 404 }
      )
    }

    // Authorization: user must be the upline Lead OR an admin
    const uplineOwnerId = (subAgent.shop_profiles as any)?.owner_id
    const { data: authUserData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isUplineLead = uplineOwnerId === user.id
    const isAdmin = (authUserData as any)?.role === 'admin' || (authUserData as any)?.role === 'sub-admin'

    if (!isUplineLead && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this sub' },
        { status: 403 }
      )
    }

    // Handle approval action
    if (action === 'approve') {
      if (subAgent.status !== 'pending') {
        return NextResponse.json(
          { error: `Cannot approve sub with status "${subAgent.status}"` },
          { status: 400 }
        )
      }

      // Activate the sub
      const { data: updated, error: updateError } = await supabase
        .from('sub_agents')
        .update({
          status: 'active',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, status, approved_at')
        .single()

      if (updateError) {
        console.error('[Approve Sub] Error:', updateError)
        return NextResponse.json(
          { error: 'Failed to approve sub' },
          { status: 500 }
        )
      }

      // TODO: Send SMS/email to sub: "You've been approved!"

      return NextResponse.json({
        success: true,
        message: 'Sub-agent approved',
        sub: updated,
      })
    }

    // Handle suspend action
    if (action === 'suspend') {
      if (subAgent.status === 'suspended') {
        return NextResponse.json(
          { error: 'Sub is already suspended' },
          { status: 400 }
        )
      }

      const { data: updated, error: updateError } = await supabase
        .from('sub_agents')
        .update({
          status: 'suspended',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, status')
        .single()

      if (updateError) {
        console.error('[Suspend Sub] Error:', updateError)
        return NextResponse.json(
          { error: 'Failed to suspend sub' },
          { status: 500 }
        )
      }

      // TODO: Send SMS to sub: "Your account has been suspended"

      return NextResponse.json({
        success: true,
        message: 'Sub-agent suspended',
        sub: updated,
      })
    }
  } catch (err: any) {
    console.error('[Sub-Agent Action] Critical error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/shop/sub-agents/[id]
 * Get a single sub-agent's details
 *
 * Authorization: User must be the upline Lead OR an admin
 * Response: { success: true, sub: {...} }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabaseAuth = await createRouteHandlerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase: any = createServerClient()

    // Get sub details with full context
    const { data: subAgent, error: fetchError } = await supabase
      .from('sub_agents')
      .select(`
        id,
        status,
        markup_ceiling,
        approved_by,
        approved_at,
        upline_shop_id,
        user_id,
        created_at,
        users!user_id(
          email,
          phone_number,
          first_name,
          last_name
        ),
        shop_profiles!upline_shop_id(
          owner_id
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !subAgent) {
      return NextResponse.json(
        { error: 'Sub-agent not found' },
        { status: 404 }
      )
    }

    // Authorization
    const uplineOwnerId = (subAgent.shop_profiles as any)?.owner_id
    const { data: authUserData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isUplineLead = uplineOwnerId === user.id
    const isAdmin = (authUserData as any)?.role === 'admin' || (authUserData as any)?.role === 'sub-admin'

    if (!isUplineLead && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to view this sub' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      sub: {
        id: subAgent.id,
        status: subAgent.status,
        markupCeiling: subAgent.markup_ceiling,
        approvedBy: subAgent.approved_by,
        approvedAt: subAgent.approved_at,
        createdAt: subAgent.created_at,
        user: subAgent.users,
      },
    })
  } catch (err: any) {
    console.error('[Get Sub] Critical error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
