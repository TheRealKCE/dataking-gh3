/**
 * Marketplace query helpers for seller profiles, conversations, messages, orders
 */

import { createServerClient } from '@/lib/supabase'
import type {
    SellerProfile,
    ListingVariant,
    Conversation,
    Message,
    MarketplaceOrder,
    GhanaRegion,
    GhanaCity,
} from '@/lib/marketplace-types'

// ⚠️ SERVER-ONLY: this uses the service-role client. Never import this module
// from a client component ('use client') — it would bundle the service client
// into the browser and crash (createServerClient reads env via dynamic
// process.env[...] which Next.js does not inline client-side). Client components
// needing reference data must use lib/marketplace-reference.ts instead.
const supabase = createServerClient()

// ============================================================
// SELLER PROFILES
// ============================================================

export async function getOrCreateSellerProfile(userId: string): Promise<SellerProfile | null> {
    const { data, error } = await supabase
        .from('marketplace_seller_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (error && error.code === 'PGRST116') {
        // Not found — create with defaults
        const { data: created } = await supabase
            .from('marketplace_seller_profiles')
            .insert({
                user_id: userId,
                display_name: '',
                region: null,
                city: null,
            })
            .select()
            .single()
        return created as SellerProfile | null
    }

    return data as SellerProfile | null
}

export async function updateSellerProfile(
    userId: string,
    updates: Partial<SellerProfile>
): Promise<SellerProfile | null> {
    const { data, error } = await supabase
        .from('marketplace_seller_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single()

    if (error) {
        console.error('[marketplace-queries] Update seller profile error:', error)
        return null
    }

    return data as SellerProfile | null
}

// ============================================================
// LISTING VARIANTS
// ============================================================

export async function getListingVariants(listingId: string): Promise<ListingVariant[]> {
    const { data, error } = await supabase
        .from('marketplace_listing_variants')
        .select('*')
        .eq('listing_id', listingId)
        .eq('is_available', true)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('[marketplace-queries] Get variants error:', error)
        return []
    }

    return (data || []) as ListingVariant[]
}

export async function createListingVariant(
    listingId: string,
    variant: any
): Promise<ListingVariant | null> {
    const { data, error } = await supabase
        .from('marketplace_listing_variants')
        .insert({
            listing_id: listingId,
            ...variant,
        })
        .select()
        .single()

    if (error) {
        console.error('[marketplace-queries] Create variant error:', error)
        return null
    }

    return data as ListingVariant | null
}

// ============================================================
// CONVERSATIONS & MESSAGES
// ============================================================

export async function getOrCreateConversation(
    listingId: string,
    buyerId: string,
    sellerId: string
): Promise<Conversation | null> {
    // Try to fetch existing
    const { data: existing } = await supabase
        .from('marketplace_conversations')
        .select('*')
        .eq('listing_id', listingId)
        .eq('buyer_id', buyerId)
        .eq('seller_id', sellerId)
        .single()

    if (existing) {
        return existing as Conversation
    }

    // Create new
    const { data, error } = await supabase
        .from('marketplace_conversations')
        .insert({
            listing_id: listingId,
            buyer_id: buyerId,
            seller_id: sellerId,
        })
        .select()
        .single()

    if (error) {
        console.error('[marketplace-queries] Create conversation error:', error)
        return null
    }

    return data as Conversation | null
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
        .from('marketplace_conversations')
        .select('*')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })

    if (error) {
        console.error('[marketplace-queries] Get conversations error:', error)
        return []
    }

    return (data || []) as Conversation[]
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
        .from('marketplace_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('[marketplace-queries] Get messages error:', error)
        return []
    }

    return (data || []) as Message[]
}

export async function sendMessage(
    conversationId: string,
    senderId: string,
    body: string
): Promise<Message | null> {
    const { data, error } = await supabase
        .from('marketplace_messages')
        .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            body,
        })
        .select()
        .single()

    if (error) {
        console.error('[marketplace-queries] Send message error:', error)
        return null
    }

    return data as Message | null
}

// ============================================================
// ORDERS
// ============================================================

export async function createMarketplaceOrder(order: any): Promise<MarketplaceOrder | null> {
    const { data, error } = await supabase
        .from('marketplace_orders')
        .insert(order)
        .select()
        .single()

    if (error) {
        console.error('[marketplace-queries] Create order error:', error)
        return null
    }

    return data as MarketplaceOrder | null
}

export async function getMarketplaceOrder(orderId: string): Promise<MarketplaceOrder | null> {
    const { data, error } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('id', orderId)
        .single()

    if (error) {
        console.error('[marketplace-queries] Get order error:', error)
        return null
    }

    return data as MarketplaceOrder | null
}

export async function getUserOrders(userId: string, role: 'buyer' | 'seller'): Promise<MarketplaceOrder[]> {
    const column = role === 'buyer' ? 'buyer_id' : 'seller_id'
    const { data, error } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq(column, userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[marketplace-queries] Get orders error:', error)
        return []
    }

    return (data || []) as MarketplaceOrder[]
}

export async function updateMarketplaceOrder(
    orderId: string,
    updates: Partial<MarketplaceOrder>
): Promise<MarketplaceOrder | null> {
    const { data, error } = await supabase
        .from('marketplace_orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single()

    if (error) {
        console.error('[marketplace-queries] Update order error:', error)
        return null
    }

    return data as MarketplaceOrder | null
}

// ============================================================
// GHANA REGIONS & CITIES
// ============================================================

export async function getGhanaRegions(): Promise<GhanaRegion[]> {
    const { data, error } = await supabase
        .from('marketplace_ghana_regions')
        .select('*')
        .order('region_name', { ascending: true })

    if (error) {
        console.error('[marketplace-queries] Get regions error:', error)
        return []
    }

    return (data || []) as GhanaRegion[]
}

export async function getGhanaCities(regionId: string): Promise<GhanaCity[]> {
    const { data, error } = await supabase
        .from('marketplace_ghana_cities')
        .select('*')
        .eq('region_id', regionId)
        .order('city_name', { ascending: true })

    if (error) {
        console.error('[marketplace-queries] Get cities error:', error)
        return []
    }

    return (data || []) as GhanaCity[]
}

export async function getAllGhanaCities(): Promise<GhanaCity[]> {
    const { data, error } = await supabase
        .from('marketplace_ghana_cities')
        .select('*, marketplace_ghana_regions(region_name)')
        .order('city_name', { ascending: true })

    if (error) {
        console.error('[marketplace-queries] Get all cities error:', error)
        return []
    }

    return (data || []) as GhanaCity[]
}
