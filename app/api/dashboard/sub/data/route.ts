import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { resolveBrandContext } from '@/lib/brand-context'

/**
 * GET /api/dashboard/sub/data
 * Fetch sub-agent dashboard data (wallet, earnings, status, brand)
 *
 * Authorization: User must be a sub-agent
 * Response: { status, walletBalance, totalEarned, totalWithdrawn, uplineShop, brandConfig }
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createRouteHandlerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Check if user is a sub-agent
    const { data: subAgent, error: subError } = await supabase
      .from('sub_agents')
      .select(`
        status,
        upline_shop_id,
        shop_profiles!upline_shop_id(
          shop_name,
          owner_phone:owner_id(phone_number)
        )
      `)
      .eq('user_id', user.id)
      .single()

    if (subError || !subAgent) {
      return NextResponse.json(
        { error: 'Not a sub-agent' },
        { status: 403 }
      )
    }

    // Get wallet data
    const { data: wallet } = await supabase
      .from('shop_wallets')
      .select('balance, total_earned, total_withdrawn')
      .eq('owner_id', user.id)
      .single()

    // Get brand context
    const brandConfig = await resolveBrandContext(user.id, supabase)

    return NextResponse.json({
      status: subAgent.status,
      walletBalance: wallet?.balance || 0,
      totalEarned: wallet?.total_earned || 0,
      totalWithdrawn: wallet?.total_withdrawn || 0,
      uplineShop: {
        shopName: (subAgent.shop_profiles as any)?.shop_name || 'Your Lead',
        contactPhone: (subAgent.shop_profiles as any)?.owner_phone,
      },
      brandConfig,
    })
  } catch (err: any) {
    console.error('[Sub Dashboard] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
