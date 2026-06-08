import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { validateAdminAccess } from '@/lib/auth-utils'
import { revalidateTag } from 'next/cache'
import { PUBLIC_CONFIG_CACHE_TAG } from '@/lib/cache-tags'

export async function POST(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }
        const { supabase: supabaseUserClient } = authResult

        const body = await request.json()
        const { rows } = body

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
        }

        // Use service role client — bypasses RLS so the upsert is allowed.
        // The admin identity has been verified above before reaching this point.
        const supabase = createServerClient()
        const { error } = await (supabase as any)
            .from('shop_global_settings')
            .upsert(rows, { onConflict: 'key' })

        if (error) throw error

        revalidateTag(PUBLIC_CONFIG_CACHE_TAG)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[AdminGlobalSettings API]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
