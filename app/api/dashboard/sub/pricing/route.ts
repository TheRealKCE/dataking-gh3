import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

/**
 * Sub-Agent storefront pricing.
 *
 * A sub prices each package on THEIR OWN storefront relative to what their Lead
 * (upline) charges: floor = the parent's retail selling_price, cap = parent
 * price + the sub's markup ceiling. Only packages the parent actually prices
 * are offered.
 *
 * GET  → { needsShop?, items: [{ packageId, network, size, parentPrice, maxPrice, currentPrice }] }
 * POST → { items: [{ packageId, sellingPrice }] } (validated against the bounds)
 */

const DEFAULT_CEILING = 5.0

async function resolveContext(userId: string, db: any) {
  // Must be a sub-agent
  const { data: sub } = await db
    .from('sub_agents')
    .select('upline_shop_id, markup_ceiling')
    .eq('user_id', userId)
    .maybeSingle()
  if (!sub) return { error: 'Not a sub-agent', status: 403 as const }

  // Must own a shop
  const { data: shop } = await db
    .from('shop_profiles')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  // Ceiling: sub's own markup_ceiling → platform default
  let ceiling = sub.markup_ceiling != null ? Number(sub.markup_ceiling) : NaN
  if (!Number.isFinite(ceiling)) {
    const { data: setting } = await db
      .from('admin_settings')
      .select('value')
      .eq('key', 'sub_markup_ceiling_default')
      .maybeSingle()
    ceiling = setting?.value != null ? Number(setting.value) : DEFAULT_CEILING
    if (!Number.isFinite(ceiling)) ceiling = DEFAULT_CEILING
  }

  return { uplineShopId: sub.upline_shop_id, shopId: shop?.id ?? null, ceiling }
}

export async function GET() {
  try {
    const auth = await createRouteHandlerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db: any = createServerClient()
    const ctx = await resolveContext(user.id, db)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    if (!ctx.shopId) {
      return NextResponse.json({ needsShop: true, items: [], ceiling: ctx.ceiling })
    }

    // Parent's retail prices (the floor)
    const { data: parentRows } = await db
      .from('shop_pricing')
      .select('package_id, selling_price')
      .eq('shop_id', ctx.uplineShopId)
    const parentPrice = new Map<string, number>()
    for (const r of parentRows || []) {
      if (r.selling_price != null) parentPrice.set(r.package_id, Number(r.selling_price))
    }

    if (parentPrice.size === 0) {
      return NextResponse.json({ items: [], ceiling: ctx.ceiling, noParentPricing: true })
    }

    // Package details
    const ids = Array.from(parentPrice.keys())
    const { data: pkgs } = await db
      .from('data_packages')
      .select('id, network, size, is_available')
      .in('id', ids)

    // Sub's current prices
    const { data: myRows } = await db
      .from('shop_pricing')
      .select('package_id, selling_price')
      .eq('shop_id', ctx.shopId)
    const myPrice = new Map<string, number>()
    for (const r of myRows || []) myPrice.set(r.package_id, Number(r.selling_price))

    const items = (pkgs || [])
      .filter((p: any) => p.is_available !== false)
      .map((p: any) => {
        const floor = parentPrice.get(p.id) as number
        return {
          packageId: p.id,
          network: p.network,
          size: p.size,
          parentPrice: floor,
          maxPrice: Math.round((floor + ctx.ceiling) * 100) / 100,
          currentPrice: myPrice.get(p.id) ?? null,
        }
      })
      .sort((a: any, b: any) =>
        a.network === b.network ? a.parentPrice - b.parentPrice : a.network.localeCompare(b.network)
      )

    return NextResponse.json({ items, ceiling: ctx.ceiling })
  } catch (err) {
    console.error('[SubPricing] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await createRouteHandlerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { items } = await request.json()
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const db: any = createServerClient()
    const ctx = await resolveContext(user.id, db)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    if (!ctx.shopId) {
      return NextResponse.json({ error: 'Create your shop first' }, { status: 400 })
    }

    // Parent prices (authoritative floor — never trust the client)
    const { data: parentRows } = await db
      .from('shop_pricing')
      .select('package_id, selling_price')
      .eq('shop_id', ctx.uplineShopId)
    const parentPrice = new Map<string, number>()
    for (const r of parentRows || []) {
      if (r.selling_price != null) parentPrice.set(r.package_id, Number(r.selling_price))
    }

    const rows: any[] = []
    for (const it of items) {
      const floor = parentPrice.get(it.packageId)
      if (floor == null) continue // package not offered by the parent — skip
      const price = Number(it.sellingPrice)
      if (!Number.isFinite(price)) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
      }
      const cap = Math.round((floor + ctx.ceiling) * 100) / 100
      if (price < floor) {
        return NextResponse.json(
          { error: `Price cannot be below the parent price of ₵${floor.toFixed(2)}` },
          { status: 400 }
        )
      }
      if (price > cap) {
        return NextResponse.json(
          { error: `Price cannot exceed ₵${cap.toFixed(2)} (parent + ceiling)` },
          { status: 400 }
        )
      }
      rows.push({
        shop_id: ctx.shopId,
        package_id: it.packageId,
        selling_price: price,
        profit_margin: Math.round((price - floor) * 100) / 100,
      })
    }

    // Replace this shop's pricing atomically enough for our purposes.
    const { error: delErr } = await db.from('shop_pricing').delete().eq('shop_id', ctx.shopId)
    if (delErr) {
      console.error('[SubPricing] delete error:', delErr)
      return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 })
    }
    if (rows.length > 0) {
      const { error: insErr } = await db.from('shop_pricing').insert(rows)
      if (insErr) {
        console.error('[SubPricing] insert error:', insErr)
        return NextResponse.json({ error: 'Failed to save pricing' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, saved: rows.length })
  } catch (err) {
    console.error('[SubPricing] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
