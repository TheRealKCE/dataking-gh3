/**
 * Bounds for a sub-agent pricing their own storefront.
 *
 * A sub prices every product relative to what the level directly above them
 * charges: floor = the upline's retail price, cap = that plus the sub's markup
 * ceiling. Shared by the data, Results Checker and AFA pricing screens so all
 * three agree on who the parent is and how much room there is above them.
 *
 * Deliberately level-agnostic: the upline is read from the caller's own
 * sub_agents row, so a level-2 sub is bounded by their level-1 recruiter
 * exactly as a level-1 sub is bounded by their Lead. Nothing here needs to know
 * how deep the caller sits.
 */

const DEFAULT_CEILING = 5.0

export interface SubPricingContext {
    uplineShopId: string
    /** The sub's own shop. Null until they create one. */
    shopId: string | null
    /** How far above the upline's price this sub may go, in GHS. */
    ceiling: number
}

export interface SubPricingContextError {
    error: string
    status: 403
}

/**
 * Resolves the caller's pricing bounds.
 *
 * @param db A service-role client — sub_agents sits behind RLS.
 */
export async function resolveSubPricingContext(
    db: any,
    userId: string
): Promise<SubPricingContext | SubPricingContextError> {
    const { data: sub } = await db
        .from('sub_agents')
        .select('upline_shop_id, markup_ceiling')
        .eq('user_id', userId)
        .maybeSingle()

    if (!sub) return { error: 'Not a sub-agent', status: 403 }

    const { data: shop } = await db
        .from('shop_profiles')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()

    // Ceiling: the sub's own markup_ceiling → the platform default.
    //
    // The default is seeded into shop_global_settings (20260703_sub_agents.sql)
    // but was only ever read from admin_settings — so the lookup always missed
    // and every sub silently got DEFAULT_CEILING no matter what an admin set.
    // Read the table it actually lives in first, keeping admin_settings as a
    // fallback so the more familiar table still has an effect.
    let ceiling = sub.markup_ceiling != null ? Number(sub.markup_ceiling) : NaN
    if (!Number.isFinite(ceiling)) {
        for (const table of ['shop_global_settings', 'admin_settings']) {
            const { data: setting } = await db
                .from(table)
                .select('value')
                .eq('key', 'sub_markup_ceiling_default')
                .maybeSingle()

            const candidate = setting?.value != null ? Number(setting.value) : NaN
            if (Number.isFinite(candidate) && candidate > 0) {
                ceiling = candidate
                break
            }
        }
        if (!Number.isFinite(ceiling)) ceiling = DEFAULT_CEILING
    }

    return { uplineShopId: sub.upline_shop_id, shopId: shop?.id ?? null, ceiling }
}

/** Highest price a sub may charge given their upline's price. */
export function ceilingFor(parentPrice: number, ceiling: number): number {
    return Math.round((parentPrice + ceiling) * 100) / 100
}
