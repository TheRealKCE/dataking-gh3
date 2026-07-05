/**
 * Marketplace types for seller profiles, variants, conversations, orders
 */

export type SellerProfile = {
    user_id: string
    display_name: string
    region: string | null
    city: string | null
    whatsapp_number: string | null
    verification_tier: 'none' | 'phone' | 'id' | 'pro'
    rating_avg: number
    rating_count: number
    response_time_hours: number | null
    is_verified: boolean
    created_at: string
    updated_at: string
}

export type ListingVariant = {
    id: string
    listing_id: string
    option1_name: string | null
    option1_value: string | null
    option2_name: string | null
    option2_value: string | null
    price_delta_pesewas: number
    quantity: number | null
    is_available: boolean
    image_url: string | null
    created_at: string
    updated_at: string
}

export type Conversation = {
    id: string
    listing_id: string
    buyer_id: string
    seller_id: string
    status: 'active' | 'archived' | 'resolved'
    last_message_at: string
    created_at: string
    updated_at: string
}

export type Message = {
    id: string
    conversation_id: string
    sender_id: string
    body: string
    read_at: string | null
    created_at: string
}

export type MarketplaceOrder = {
    id: string
    listing_id: string
    variant_id: string | null
    buyer_id: string
    seller_id: string
    quantity: number
    price_pesewas: number
    commission_rate_percent: number
    commission_pesewas: number
    payment_mode: 'direct' | 'split' | 'escrow'
    status: 'created' | 'paid_escrowed' | 'shipped' | 'delivered_confirmed' | 'released' | 'settled' | 'refunded' | 'disputed' | 'cancelled'
    variant_snapshot: any | null
    reference_code: string | null
    buyer_notes: string | null
    seller_notes: string | null
    shipped_at: string | null
    delivered_at: string | null
    created_at: string
    updated_at: string
}

export type GhanaRegion = {
    id: string
    region_name: string
    region_code: string
    created_at: string
}

export type GhanaCity = {
    id: string
    region_id: string
    city_name: string
}

// Create/Update DTOs
export type CreateSellerProfileDTO = {
    display_name: string
    region?: string
    city?: string
    whatsapp_number?: string
}

export type UpdateSellerProfileDTO = Partial<CreateSellerProfileDTO>

export type CreateListingVariantDTO = {
    option1_name?: string
    option1_value?: string
    option2_name?: string
    option2_value?: string
    price_delta_pesewas?: number
    quantity?: number
    image_url?: string
}

export type CreateConversationDTO = {
    listing_id: string
    buyer_id?: string // Optional, defaults to current user
    seller_id: string
}

export type CreateMessageDTO = {
    conversation_id: string
    body: string
}

export type CreateMarketplaceOrderDTO = {
    listing_id: string
    variant_id?: string
    quantity: number
    payment_mode: 'direct' | 'split' | 'escrow'
    buyer_notes?: string
}
