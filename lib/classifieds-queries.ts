import { createClient } from '@supabase/supabase-js'
import type { Database, ClassifiedListing, ClassifiedCategory } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function getListingsWithPagination(params: {
    page?: number
    limit?: number
    category_id?: string
    location?: string
    price_min?: number
    price_max?: number
    status?: string
    seller_id?: string
}) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const page = params.page || 1
    const limit = params.limit || 20
    const offset = (page - 1) * limit

    let query = supabase
        .from('classified_listings')
        .select('*, classified_categories(name, slug)', { count: 'exact' })
        .eq('status', params.status || 'active')

    if (params.category_id) {
        query = query.eq('category_id', params.category_id)
    }

    if (params.location) {
        query = query.ilike('location', `%${params.location}%`)
    }

    if (params.price_min !== undefined) {
        query = query.gte('price', params.price_min)
    }

    if (params.price_max !== undefined) {
        query = query.lte('price', params.price_max)
    }

    if (params.seller_id) {
        query = query.eq('seller_id', params.seller_id)
    }

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (error) throw error

    return {
        listings: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
    }
}

export async function getListingById(id: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_listings')
        .select(`
            *,
            classified_categories(name, slug),
            classified_listing_images(id, storage_path, display_order),
            users(first_name, last_name, phone_number, email)
        `)
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

export async function getSellerListings(sellerId: string, status?: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    let query = supabase
        .from('classified_listings')
        .select('*')
        .eq('seller_id', sellerId)

    if (status) {
        query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function searchListings(searchQuery: string, filters?: { category_id?: string; location?: string; price_min?: number; price_max?: number }) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    let query = supabase
        .from('classified_listings')
        .select('*, classified_categories(name)')
        .eq('status', 'active')

    if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
    }

    if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id)
    }

    if (filters?.location) {
        query = query.ilike('location', `%${filters.location}%`)
    }

    if (filters?.price_min !== undefined) {
        query = query.gte('price', filters.price_min)
    }

    if (filters?.price_max !== undefined) {
        query = query.lte('price', filters.price_max)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50)

    if (error) throw error
    return data || []
}

export async function getCategories() {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_categories')
        .select('*')
        .order('display_order')

    if (error) throw error
    return data || []
}

export async function getCategoryBySlug(slug: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_categories')
        .select('*')
        .eq('slug', slug)
        .single()

    if (error) throw error
    return data
}

export async function getUserFavorites(userId: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_favorites')
        .select('listing_id')
        .eq('user_id', userId)

    if (error) throw error
    return (data || []).map(fav => fav.listing_id)
}

export async function toggleFavorite(userId: string, listingId: string, action: 'add' | 'remove') {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    if (action === 'add') {
        const { error } = await supabase
            .from('classified_favorites')
            .insert({ user_id: userId, listing_id: listingId })
        if (error) throw error
    } else {
        const { error } = await supabase
            .from('classified_favorites')
            .delete()
            .eq('user_id', userId)
            .eq('listing_id', listingId)
        if (error) throw error
    }
}

export async function getContactReveal(listingId: string, buyerId: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_contact_reveals')
        .select('*')
        .eq('listing_id', listingId)
        .eq('buyer_id', buyerId)
        .single()

    if (error?.code === 'PGRST116') {
        return null
    }

    if (error) throw error
    return data
}

export async function recordContactReveal(listingId: string, buyerId: string, acknowledgedSafety: boolean) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_contact_reveals')
        .upsert({
            listing_id: listingId,
            buyer_id: buyerId,
            revealed_at: new Date().toISOString(),
            acknowledged_safety_tips_at: acknowledgedSafety ? new Date().toISOString() : null,
        })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function incrementViewCount(listingId: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: current } = await supabase
        .from('classified_listings')
        .select('view_count')
        .eq('id', listingId)
        .single()

    await supabase
        .from('classified_listings')
        .update({ view_count: (current?.view_count || 0) + 1 })
        .eq('id', listingId)
}

export async function createListing(sellerId: string, listing: {
    title: string
    description: string
    category_id: string
    price: number
    location?: string
    condition?: 'new' | 'like-new' | 'used' | 'refurbished'
    contact_phone?: string
    contact_email?: string
    expires_at?: string
}) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_listings')
        .insert({
            seller_id: sellerId,
            ...listing,
        })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateListing(listingId: string, updates: Partial<ClassifiedListing>) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_listings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', listingId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteListing(listingId: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { error } = await supabase
        .from('classified_listings')
        .update({ status: 'archived' })
        .eq('id', listingId)

    if (error) throw error
}

export async function addListingImage(listingId: string, storagePath: string, displayOrder: number = 0) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_listing_images')
        .insert({
            listing_id: listingId,
            storage_path: storagePath,
            display_order: displayOrder,
        })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function getListingImages(listingId: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
        .from('classified_listing_images')
        .select('*')
        .eq('listing_id', listingId)
        .order('display_order')

    if (error) throw error
    return data || []
}
