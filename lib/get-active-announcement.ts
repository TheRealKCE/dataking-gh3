import { createClient } from '@supabase/supabase-js'
import { unstable_noStore as noStore } from 'next/cache'

/**
 * Fetches the latest active system announcement DIRECTLY from the database
 * using the service role key — bypasses ALL RLS and Next.js cache.
 * Used server-side in the root layout to guarantee fresh data on every request.
 */
export async function getActiveAnnouncement() {
    noStore() // Opt-out of Next.js static caching completely
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !serviceKey) return null

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
        })

        const { data, error } = await supabase
            .from('system_announcements')
            .select('id, title, message, visible_on')
            .eq('is_active', true)
            .in('visible_on', ['main_site', 'both'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error || !data) return null
        return data
    } catch {
        return null
    }
}
