'use server'

import { revalidateTag } from 'next/cache'
import { PUBLIC_CONFIG_CACHE_TAG } from '@/lib/cache-tags'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function revalidatePublicConfig() {
    try {
        const supabase = await createRouteHandlerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return { error: 'Unauthorized' }

        const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (dbUser?.role !== 'admin' && dbUser?.role !== 'sub-admin') {
            return { error: 'Forbidden' }
        }

        revalidateTag(PUBLIC_CONFIG_CACHE_TAG)
        return { success: true }
    } catch (error) {
        console.error('Error revalidating config:', error)
        return { error: 'Failed to revalidate' }
    }
}
