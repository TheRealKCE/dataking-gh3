import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

/**
 * GET /api/shop/sub-agents
 * List all sub-agents under the authenticated user's shop
 *
 * Authorization: User must own the shop
 * Query params: status? ('pending' | 'active' | 'suspended')
 * Response: { success: true, subs: [...], shopId, shopName }
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createRouteHandlerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase: any = createServerClient()

    // Get user's shop
    const { data: shop, error: shopError } = await supabase
      .from('shop_profiles')
      .select('id, shop_name')
      .eq('owner_id', user.id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      )
    }

    // Get all sub-agents under this shop
    let query = supabase
      .from('sub_agents')
      .select(`
        id,
        status,
        markup_ceiling,
        approved_by,
        approved_at,
        created_at,
        users!user_id(
          email,
          phone_number,
          first_name,
          last_name
        )
      `)
      .eq('upline_shop_id', shop.id)

    // Optional status filter
    const statusParam = request.nextUrl.searchParams.get('status')
    if (statusParam && ['pending', 'active', 'suspended'].includes(statusParam)) {
      query = query.eq('status', statusParam)
    }

    const { data: subs, error: subsError } = await query.order('created_at', {
      ascending: false,
    })

    if (subsError) {
      console.error('[Sub-Agents GET] Error:', subsError)
      return NextResponse.json(
        { error: 'Failed to fetch sub-agents' },
        { status: 500 }
      )
    }

    // Format response
    const formattedSubs = (subs || []).map((sub: any) => ({
      id: sub.id,
      status: sub.status,
      markupCeiling: sub.markup_ceiling,
      approvedAt: sub.approved_at,
      approvedBy: sub.approved_by,
      createdAt: sub.created_at,
      user: sub.users,
    }))

    return NextResponse.json({
      success: true,
      subs: formattedSubs,
      shopId: shop.id,
      shopName: shop.shop_name,
    })
  } catch (err: any) {
    console.error('[Sub-Agents GET] Critical error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
