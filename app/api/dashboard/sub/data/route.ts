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

    const supabase: any = createServerClient()

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

    // The sub's OWN storefront slug (null until they create their shop) — used so
    // the dashboard "Shop" tile opens the sub's own store, not the upline's.
    const { data: ownShop } = await supabase
      .from('shop_profiles')
      .select('shop_slug')
      .eq('owner_id', user.id)
      .maybeSingle()

    // Get brand context
    const brandConfig = await resolveBrandContext(user.id, supabase)

    return NextResponse.json({
      status: subAgent.status,
      walletBalance: wallet?.balance || 0,
      totalEarned: wallet?.total_earned || 0,
      totalWithdrawn: wallet?.total_withdrawn || 0,
      ownShopSlug: ownShop?.shop_slug || null,
      uplineShop: {
        shopName: (subAgent.shop_profiles as any)?.shop_name || 'Your Lead',
        // `owner_phone:owner_id(phone_number)` is a to-one embed, so it comes
        // back as an object { phone_number }. Extract the string — the dashboard
        // renders contactPhone directly, and rendering the object crashes React
        // (error #31: "Objects are not valid as a React child").
        contactPhone: (subAgent.shop_profiles as any)?.owner_phone?.phone_number || null,
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
