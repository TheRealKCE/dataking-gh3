/**
 * Consolidated cost-basis resolver for all role → cost pricing paths.
 * This is the single source of truth for pricing logic across TS and SQL.
 *
 * Rule (documented + tested in test-cost-basis.ts):
 *   owner_cost(pkg, role, agent_expires_at, dealer_expires_at) =
 *     - dealer_price   if role='dealer' AND dealer_expires_at > now() AND dealer_price > 0
 *     - agent_price    if role='agent' AND (agent_expires_at IS NULL OR agent_expires_at > now()) AND agent_price > 0
 *     - price          otherwise (customer tier / fallback when a tier price is null or 0)
 */

export interface PricingTiers {
  price: number; // Customer/fallback price
  agentPrice?: number | null;
  dealerPrice?: number | null;
}

export interface OwnerState {
  role: 'customer' | 'agent' | 'dealer';
  agentExpiresAt: string | null; // ISO string or null
  dealerExpiresAt: string | null; // ISO string or null
}

/**
 * Determines the cost basis for a shop owner based on their role and expiry state.
 * Used to calculate profit floors and pricing constraints across all charge paths.
 *
 * @param pricing - Package pricing tiers
 * @param owner - Owner state (role + expiry dates)
 * @returns The cost basis (the amount the platform charges the owner)
 */
export function resolveOwnerCost(pricing: PricingTiers, owner: OwnerState): number {
  const now = new Date();

  // Dealer: active dealers get dealer_price
  if (
    owner.role === 'dealer' &&
    owner.dealerExpiresAt &&
    new Date(owner.dealerExpiresAt) > now &&
    pricing.dealerPrice &&
    pricing.dealerPrice > 0
  ) {
    return pricing.dealerPrice;
  }

  // Agent: lifetime agents (agent_expires_at IS NULL) or non-expired agents get agent_price
  if (
    owner.role === 'agent' &&
    (!owner.agentExpiresAt || new Date(owner.agentExpiresAt) > now) &&
    pricing.agentPrice &&
    pricing.agentPrice > 0
  ) {
    return pricing.agentPrice;
  }

  // Fallback to customer price
  return pricing.price;
}

/**
 * Determines if a user is eligible to own a sub-network.
 * Eligibility is evaluated live at every gate (never cached).
 * Rule: (role='agent' AND agent_expires_at IS NULL) OR (role='dealer' AND dealer_expires_at > now())
 *
 * @param owner - Owner state (role + expiry dates)
 * @returns True if the user can own subs
 */
export function canOwnSubNetwork(owner: OwnerState): boolean {
  const now = new Date();

  // Lifetime agents only (not temporary agents)
  if (owner.role === 'agent' && !owner.agentExpiresAt) {
    return true;
  }

  // Active dealers
  if (
    owner.role === 'dealer' &&
    owner.dealerExpiresAt &&
    new Date(owner.dealerExpiresAt) > now
  ) {
    return true;
  }

  return false;
}

/**
 * Determines the cost basis for a sub purchasing from their upline.
 * The sub always pays the upline's sub_price (set by the Lead).
 *
 * @param subPrice - The upline's wholesale sub_price for this package
 * @returns The cost to the sub
 */
export function resolveSubCost(subPrice: number | null | undefined): number | null {
  // If sub_price is not set, the package is not yet available to subs
  if (subPrice === null || subPrice === undefined) {
    return null;
  }
  return subPrice;
}

/**
 * Validate that a sub_price is coherent with the owner's cost basis.
 * Enforced at pricing write time: sub_price >= owner_cost + platform_min_sub_margin
 *
 * @param subPrice - The proposed sub_price
 * @param ownerCost - The upline owner's cost basis
 * @param minSubMargin - Platform minimum margin (e.g., 0.50 GHS)
 * @returns True if valid, false otherwise
 */
export function isSubPriceValid(
  subPrice: number,
  ownerCost: number,
  minSubMargin: number
): boolean {
  return subPrice >= ownerCost + minSubMargin;
}
