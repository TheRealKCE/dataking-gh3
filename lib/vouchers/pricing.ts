/**
 * Results Checker Voucher – Server-Side Pricing
 *
 * IMPORTANT: Never trust prices from the client. All prices are calculated
 * here on the server using data fetched directly from the database.
 */

export interface RCType {
    id: string
    name: string
    customer_price: number
    agent_price: number
    cost_price: number
    is_active: boolean
    display_order: number
    bulk_pricing?: Array<{
        min_qty: number
        max_qty: number
        unit_price: number
    }>
}

export interface RCPriceBreakdown {
    unitPrice: number
    shopMarkup: number
    subtotal: number
    paystackFee: number
    total: number
}

/**
 * Calculate the final price for a Results Checker voucher order.
 * Applies role-based pricing, bulk tiers, shop markup, and optional gateway fees.
 * Throws if any price falls below the supplier cost price.
 */
export async function calculateRCPrice(params: {
    type: RCType
    quantity: number
    userRole: string
    shopMarkup?: number
    includePaystackFee?: boolean
}): Promise<RCPriceBreakdown> {
    const { type, quantity, userRole, shopMarkup = 0, includePaystackFee = false } = params

    // 1. Resolve role-based pricing
    let unitPrice =
        userRole === 'agent' && type.agent_price > 0
            ? type.agent_price
            : type.customer_price

    // 2. Apply bulk tiers (if applicable)
    if (type.bulk_pricing && type.bulk_pricing.length > 0) {
        const matchedTier = type.bulk_pricing.find(
            (tier) => quantity >= tier.min_qty && quantity <= tier.max_qty
        )
        if (matchedTier) {
            unitPrice = Math.max(matchedTier.unit_price, type.cost_price)
        }
    }

    // 3. Absolute security guard: price must never drop below supplier cost
    if (unitPrice < type.cost_price) {
        throw new Error('PRICING_ERROR_UNIT_BELOW_COST')
    }

    const subtotal = (unitPrice + shopMarkup) * quantity

    // 4. Calculate optional Paystack processing fee (1.95%)
    let paystackFee = 0
    if (includePaystackFee) {
        const feePercent = 1.95
        paystackFee = parseFloat((subtotal * (feePercent / 100)).toFixed(2))
    }

    return {
        unitPrice,
        shopMarkup,
        subtotal: parseFloat(subtotal.toFixed(2)),
        paystackFee,
        total: parseFloat((subtotal + paystackFee).toFixed(2)),
    }
}

/**
 * Fetch a single active RC type from the database by ID.
 * Uses service-role client to bypass RLS.
 */
export async function getRCTypeById(
    supabase: any,
    typeId: string
): Promise<RCType | null> {
    const { data, error } = await (supabase.from('results_checker_types') as any)
        .select('*')
        .eq('id', typeId)
        .eq('is_active', true)
        .single()

    if (error || !data) return null
    return data as RCType
}
