/**
 * Sub-agent membership context — the one place that answers "is this user a
 * sub, and may they trade right now?".
 *
 * Every sub gate needs the same three facts: the membership row, who the upline
 * is, and whether that upline is *still* eligible to run a network. Eligibility
 * is evaluated live at every gate (never cached) because a dealer whose
 * subscription lapsed must stop backing their subs the moment it lapses.
 */

import { canOwnSubNetwork } from './pricing/cost-basis'

export interface SubAgentContext {
    isSub: boolean
    /** 'pending' | 'active' | 'suspended' — null when the user is not a sub. */
    status: string | null
    uplineShopId: string | null
    uplineOwnerId: string | null
    /** Live evaluation of the upline's right to own a sub-network. */
    uplineEligible: boolean
}

const NOT_A_SUB: SubAgentContext = {
    isSub: false,
    status: null,
    uplineShopId: null,
    uplineOwnerId: null,
    uplineEligible: false,
}

/** Wording reused by every gate so a blocked sub always reads the same message. */
export const SUB_INACTIVE_ERROR = 'Your sub-agent account is not active'
export const UPLINE_INELIGIBLE_ERROR =
    'Your upline Lead is no longer eligible to operate. Please contact support.'

/**
 * Resolves the sub-agent context for `userId`.
 *
 * @param db A service-role client — sub_agents and the upline's users row are
 *           both behind RLS that an ordinary caller cannot read.
 */
export async function resolveSubAgentContext(
    db: any,
    userId: string
): Promise<SubAgentContext> {
    if (!userId) return NOT_A_SUB

    const { data: sub } = await db
        .from('sub_agents')
        .select('status, upline_shop_id')
        .eq('user_id', userId)
        .maybeSingle()

    if (!sub) return NOT_A_SUB

    const uplineShopId = sub.upline_shop_id || null

    const { data: uplineShop } = uplineShopId
        ? await db
            .from('shop_profiles')
            .select('owner_id')
            .eq('id', uplineShopId)
            .maybeSingle()
        : { data: null }

    const uplineOwnerId = (uplineShop as any)?.owner_id || null

    let uplineEligible = false
    if (uplineOwnerId) {
        const { data: uplineUser } = await db
            .from('users')
            .select('role, agent_expires_at, dealer_expires_at')
            .eq('id', uplineOwnerId)
            .maybeSingle()

        if (uplineUser) {
            uplineEligible = canOwnSubNetwork({
                role: (uplineUser as any).role,
                agentExpiresAt: (uplineUser as any).agent_expires_at ?? null,
                dealerExpiresAt: (uplineUser as any).dealer_expires_at ?? null,
            })
        }
    }

    return {
        isSub: true,
        status: sub.status || null,
        uplineShopId,
        uplineOwnerId,
        uplineEligible,
    }
}
