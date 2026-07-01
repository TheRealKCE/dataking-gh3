import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function verifyAuth(token?: string) {
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: token ? { persistSession: false } : undefined,
    })

    if (token) {
        const { data } = await supabase.auth.getUser(token)
        return data?.user?.id || null
    }

    const { data } = await supabase.auth.getUser()
    return data?.user?.id || null
}

export async function verifySellerAuth(userId: string | null) {
    if (!userId) return false

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: user } = await supabase
        .from('users')
        .select('is_seller, role')
        .eq('id', userId)
        .single()

    return user?.is_seller === true || ['admin', 'sub-admin'].includes(user?.role || '')
}

export async function verifyBuyerAuth(userId: string | null) {
    return !!userId
}

export async function verifyAdminAuth(userId: string | null) {
    if (!userId) return false

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

    return ['admin', 'sub-admin'].includes(user?.role || '')
}

export async function getCurrentUser(userId: string | null) {
    if (!userId) return null

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: user } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone_number, is_seller, role')
        .eq('id', userId)
        .single()

    return user
}
