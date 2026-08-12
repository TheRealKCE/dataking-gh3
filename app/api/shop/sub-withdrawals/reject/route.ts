import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

/**
 * POST /api/shop/sub-withdrawals/reject
 * Lead rejects a pending sub withdrawal (refunds the amount)
 *
 * Calls: reject_sub_withdrawal(withdrawal_id, note) RPC
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

    const supabase: any = createServerClient()

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
        { error: 'You do not have permission to reject this withdrawal' },
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

    // Call RPC to reject (refunds the amount). The caller is passed explicitly:
    // this is a service-role client, so auth.uid() inside the RPC is NULL and it
    // would refuse every rejection. Ownership is verified above and in the RPC.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'reject_sub_withdrawal',
      {
        p_withdrawal_id: withdrawalId,
        p_rejection_note: note || null,
        p_caller_id: user.id,
      }
    )

    if (rpcError) {
      console.error('[Reject Withdrawal] RPC error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message || 'Failed to reject withdrawal' },
        { status: 500 }
      )
    }

    // A refusal comes back in the payload, not as a Postgres error. Reporting
    // success here would tell the Lead the sub was refunded when they were not.
    if (!rpcResult?.success) {
      console.error('[Reject Withdrawal] RPC refused:', rpcResult)
      return NextResponse.json(
        { error: rpcResult?.message || 'Failed to reject withdrawal' },
        { status: 400 }
      )
    }

    // Fetch updated withdrawal
    const { data: updated } = await supabase
      .from('shop_wallet_transactions')
      .select('id, status, sub_approval_status, amount')
      .eq('id', withdrawalId)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Withdrawal rejected and amount refunded to sub',
      withdrawal: updated,
    })
  } catch (err: any) {
    console.error('[Reject Withdrawal] Critical error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
