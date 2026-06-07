import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/public/announcement
 *
 * Returns the latest active system announcement for the main site.
 * - No caching: always returns fresh data (critical for login popups)
 * - Uses service role key to bypass RLS and guarantee read access
 * - Only returns announcements visible on 'main_site' or 'both'
 */
export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({ announcement: null })
        }

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

        if (error || !data) {
            return NextResponse.json(
                { announcement: null },
                { headers: { 'Cache-Control': 'no-store' } }
            )
        }

        return NextResponse.json(
            { announcement: data },
            { headers: { 'Cache-Control': 'no-store' } }
        )
    } catch (error) {
        console.error('[AnnouncementAPI] Error:', error)
        return NextResponse.json(
            { announcement: null },
            { headers: { 'Cache-Control': 'no-store' } }
        )
    }
}
