import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

/**
 * GET /api/admin/shops/[shopId]/sub-agents
 * List all sub-agents under a specific shop (admin only)
 *
 * Authorization: User must be an admin
 * Response: { success: true, subs: [...], shopId, shopName }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params

    const supabaseAuth = await createRouteHandlerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase: any = createServerClient()

    // Verify user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = (userData as any)?.role === 'admin' || (userData as any)?.role === 'sub-admin'
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get shop info
    const { data: shop } = await supabase
      .from('shop_profiles')
      .select('id, shop_name')
      .eq('id', shopId)
      .single()

    // List sub-agents
    const { data: subs, error: subsError } = await supabase
      .from('sub_agents')
      .select(`
        id,
        status,
        created_at,
        users!user_id(
          email,
          phone_number,
          first_name
        )
      `)
      .eq('upline_shop_id', shopId)
      .order('created_at', { ascending: false })

    if (subsError) {
      console.error('[Admin Sub-Agents] Error:', subsError)
      return NextResponse.json(
        { error: 'Failed to fetch sub-agents' },
        { status: 500 }
      )
    }

    const formattedSubs = (subs || []).map((sub: any) => ({
      id: sub.id,
      status: sub.status,
      createdAt: sub.created_at,
      user: sub.users,
    }))

    return NextResponse.json({
      success: true,
      subs: formattedSubs,
      shopId,
      shopName: (shop as any)?.shop_name,
    })
  } catch (err: any) {
    console.error('[Admin Sub-Agents GET] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
