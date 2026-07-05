import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

/**
 * DELETE /api/shop/invites/[id]
 * Revoke an invite code (prevents further signup via this code)
 *
 * Authorization: User must own the shop that created the invite
 * Response: { success: true }
 */
export async function DELETE(
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

    // Get the invite to verify ownership
    const { data: invite, error: fetchError } = await supabase
      .from('shop_invites')
      .select('shop_id, shop_profiles!shop_id(owner_id)')
      .eq('id', id)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    const shopOwnerId = (invite.shop_profiles as any)?.owner_id
    if (shopOwnerId !== user.id) {
      return NextResponse.json(
        { error: 'You do not own this invite' },
        { status: 403 }
      )
    }

    // Revoke the invite
    const { error: revokeError } = await supabase
      .from('shop_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)

    if (revokeError) {
      console.error('[Revoke Invite] Error:', revokeError)
      return NextResponse.json(
        { error: 'Failed to revoke invite' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invite revoked',
    })
  } catch (err: any) {
    console.error('[Revoke Invite] Critical error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
