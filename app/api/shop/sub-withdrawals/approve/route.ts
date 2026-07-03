import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

/**
 * POST /api/shop/sub-withdrawals/approve
 * Lead approves a pending sub withdrawal (moves to admin payout queue)
 *
 * Calls: approve_sub_withdrawal(withdrawal_id, note) RPC
 * Authorization: User must be the upline Lead
 * Body: { withdrawalId: string, note?: string }
 * Response: { success: true, withdrawal: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    const { withdrawalId, note } = await request.json()

    if (!withdrawalId) {
      return NextResponse.json(
        { error: 'withdrawalId is required' },
        { status: 400 }
      )
    }

    const supabaseAuth = await createRouteHandlerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Fetch withdrawal details to verify authorization
    const { data: withdrawal, error: fetchError } = await supabase
      .from('shop_wallet_transactions')
      .select(`
        id,
        status,
        sub_approval_status,
        amount,
        shop_wallet_id,
        shop_wallets!shop_wallet_id(
          owner_id,
          sub_agents!owner_id(
            upline_shop_id,
            shop_profiles!upline_shop_id(
              owner_id
            )
          )
        )
      `)
      .eq('id', withdrawalId)
      .single()

    if (fetchError || !withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      )
    }

    // Verify authorization: user must be the upline Lead
    const subData = (withdrawal.shop_wallets as any)?.sub_agents
    const uplineOwnerId = (subData?.shop_profiles as any)?.owner_id

    if (uplineOwnerId !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to approve this withdrawal' },
        { status: 403 }
      )
    }

    // Verify state: must be in shop_owner_pending status and pending approval
    if (withdrawal.status !== 'shop_owner_pending') {
      return NextResponse.json(
        { error: `Withdrawal is not pending approval (status: ${withdrawal.status})` },
        { status: 400 }
      )
    }

    if (withdrawal.sub_approval_status !== 'pending') {
      return NextResponse.json(
        { error: `Withdrawal has already been ${withdrawal.sub_approval_status}` },
        { status: 400 }
      )
    }

    // Call RPC to approve
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'approve_sub_withdrawal',
      {
        p_withdrawal_id: withdrawalId,
        p_approval_note: note || null,
      }
    )

    if (rpcError) {
      console.error('[Approve Withdrawal] RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message || 'Failed to approve withdrawal' },
        { status: 500 }
      )
    }

    // Fetch updated withdrawal
    const { data: updated } = await supabase
      .from('shop_wallet_transactions')
      .select('id, status, sub_approval_status, sub_approved_at, amount')
      .eq('id', withdrawalId)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Withdrawal approved and moved to admin payout queue',
      withdrawal: updated,
    })
  } catch (err: any) {
    console.error('[Approve Withdrawal] Critical error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
