/**
 * Authoritative price resolution for a data package purchase.
 *
 * Extracted from app/api/orders/purchase/route.ts so that the wallet path and
 * the direct-pay path (/api/orders/gateway-init) charge exactly the same
 * amount. Never trust a client-supplied price — always resolve here.
 */

export interface ResolvedDataPrice {
    price: number
    role: string
    isSubAgent: boolean
    uplineShopId: string | null
}

export interface ResolveDataPriceResult {
    ok: boolean
    data?: ResolvedDataPrice
    /** Set when ok is false — safe to surface to the client. */
    error?: string
    /** HTTP status to respond with when ok is false. */
    status?: number
}

/**
 * Resolves what `userId` must pay for `pkg`.
 *
 * Sub-agents pay their upline's `sub_price` (and are gated on their own status
 * plus a live evaluation of the upline's eligibility). Everyone else gets
 * role pricing: dealer → agent → base.
 *
 * @param supabase A service-role client (needs to read sub_agents/shop_pricing).
 */
export async function resolveDataPrice(
    supabase: any,
    userId: string,
    pkg: any
): Promise<ResolveDataPriceResult> {
    // Get user role + sub-agent status for price calculation
    const { data: userRoleData } = await supabase
        .from('users')
        .select('role, agent_expires_at, dealer_expires_at')
        .eq('id', userId)
        .single()

    const userRole = (userRoleData as any)?.role
    const isAgent = userRole === 'agent'
    const isDealer = userRole === 'dealer'

    // Check if user is a sub-agent
    const { data: subAgentData } = await supabase
        .from('sub_agents')
        .select('id, status, upline_shop_id')
        .eq('user_id', userId)
        .single()

    if (subAgentData) {
        const uplineShopId = subAgentData.upline_shop_id

        // Eligibility gate: sub must be active + upline must be eligible
        if (subAgentData.status !== 'active') {
            return { ok: false, error: 'Your sub-agent account is not active', status: 403 }
        }

        // Check upline eligibility (live evaluation, never cached)
        const { data: uplineOwner } = await supabase
            .from('shop_profiles')
            .select('owner_id')
            .eq('id', uplineShopId)
            .single()

        if (uplineOwner) {
            const { data: uplineUserData } = await supabase
                .from('users')
                .select('role, agent_expires_at, dealer_expires_at')
                .eq('id', uplineOwner.owner_id)
                .single()

            const uplineRole = (uplineUserData as any)?.role
            const uplineAgentExpiresAt = (uplineUserData as any)?.agent_expires_at
            const uplineDealerExpiresAt = (uplineUserData as any)?.dealer_expires_at
            const now = new Date()

            // Eligibility: (role='agent' AND agent_expires_at IS NULL) OR (role='dealer' AND dealer_expires_at > now())
            const isUplineEligible =
                (uplineRole === 'agent' && !uplineAgentExpiresAt) ||
                (uplineRole === 'dealer' && uplineDealerExpiresAt && new Date(uplineDealerExpiresAt) > now)

            if (!isUplineEligible) {
                return {
                    ok: false,
                    error: 'Your upline Lead is no longer eligible to operate. Please contact support.',
                    status: 403,
                }
            }
        }

        // Get sub_price from upline's pricing for this package
        const { data: subPricingData } = await supabase
            .from('shop_pricing')
            .select('sub_price')
            .eq('shop_id', uplineShopId)
            .eq('package_id', pkg.id)
            .single()

        if (!subPricingData || !subPricingData.sub_price) {
            return {
                ok: false,
                error: 'This package is not yet available for sub-agents',
                status: 400,
            }
        }

        return {
            ok: true,
            data: {
                price: subPricingData.sub_price,
                role: userRole || 'customer',
                isSubAgent: true,
                uplineShopId,
            },
        }
    }

    // Regular user: apply role-based pricing
    const price = (isDealer && (pkg as any).dealer_price > 0)
        ? (pkg as any).dealer_price
        : (isAgent && (pkg as any).agent_price > 0)
            ? (pkg as any).agent_price
            : (pkg as any).price

    return {
        ok: true,
        data: {
            price,
            role: userRole || 'customer',
            isSubAgent: false,
            uplineShopId: null,
        },
    }
}
