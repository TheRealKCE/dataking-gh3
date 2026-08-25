import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { resolveSubPricingContext } from '@/lib/sub-pricing-context'

/**
 * Sub-Agent storefront pricing.
 *
 * A sub prices each package on THEIR OWN storefront relative to what the level
 * above them charges: floor = that parent's retail selling_price, cap = parent
 * price + the sub's markup ceiling. Only packages the parent actually prices
 * are offered.
 *
 * Level-agnostic by construction — the parent comes from the caller's own
 * sub_agents row — so a level-2 sub prices against their level-1 recruiter with
 * no special casing, and their storefront goes live the moment they save.
 *
 * GET  → { needsShop?, items: [{ packageId, network, size, parentPrice, maxPrice, currentPrice }] }
 * POST → { items: [{ packageId, sellingPrice }] } (validated against the bounds)
 */

const resolveContext = (userId: string, db: any) => resolveSubPricingContext(db, userId)

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
      const margin = Math.round((price - floor) * 100) / 100
      // shop_pricing requires profit_margin > 0, so the price must sit strictly
      // above the parent's — matching it exactly isn't allowed.
      if (margin <= 0) {
        return NextResponse.json(
          { error: `Price must be above the parent price of ₵${floor.toFixed(2)}` },
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
        profit_margin: margin,
      })
    }

    // Carry each package's wholesale price across the rewrite.
    //
    // shop_pricing.sub_price is what THIS shop charges the level below them,
    // set on a different screen (/api/shop/sub-pricing). The replace below
    // would drop it on every retail save, silently wiping the whole downline's
    // cost basis.
    //
    // It has to survive a delete-and-reinsert rather than becoming an upsert:
    // protect_shop_pricing_updates() raises 'profit_margin cannot be changed
    // after creation' on any UPDATE that moves profit_margin, and re-pricing
    // always moves it. Replacing the row is what has always sidestepped that.
    const { data: existing } = await db
      .from('shop_pricing')
      .select('package_id, sub_price')
      .eq('shop_id', ctx.shopId)

    const wholesale = new Map<string, number>(
      (existing || [])
        .filter((r: any) => r.sub_price != null)
        .map((r: any) => [r.package_id, Number(r.sub_price)])
    )

    for (const row of rows) {
      const kept = wholesale.get(row.package_id)
      if (kept != null) (row as any).sub_price = kept
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

    // Keep the sub's storefront live: their prices are already bounded by the
    // parent, so there's no separate admin pricing review — approve it so the
    // storefront never shows "Under Review".
    await db.from('shop_profiles').update({ pricing_status: 'approved' }).eq('id', ctx.shopId)

    return NextResponse.json({ success: true, saved: rows.length })
  } catch (err) {
    console.error('[SubPricing] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
