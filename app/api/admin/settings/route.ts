import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { PUBLIC_CONFIG_CACHE_TAG } from '@/lib/cache-tags'

// Whitelist of keys that can be read/written via this generic endpoint
const ALLOWED_KEYS = [
    'storefront_rc_enabled',
    'storefront_airtime_enabled',
    'storefront_mashup_enabled',
    'shop_feature_enabled',
]

async function verifyAdmin(supabaseUserClient: any) {
    const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
    if (authError || !authUser) return null
    const supabase = createServerClient()
    const { data: user } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (user as any)?.role
    if (!['admin', 'sub-admin'].includes(role)) return null
    return { userId: authUser.id }
}

// GET /api/admin/settings?key=storefront_rc_enabled
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore
        })
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const key = request.nextUrl.searchParams.get('key')

        const supabase = createServerClient()

        if (key) {
            if (!ALLOWED_KEYS.includes(key)) {
                return NextResponse.json({ error: 'Key not permitted' }, { status: 403 })
            }
            const { data, error } = await (supabase.from('admin_settings') as any)
                .select('value')
                .eq('key', key)
                .maybeSingle()

            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ key, value: data?.value ?? null })
        }

        // Return all allowed keys
        const { data, error } = await (supabase.from('admin_settings') as any)
            .select('key, value')
            .in('key', ALLOWED_KEYS)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const settings: Record<string, string> = {}
        for (const row of (data || [])) {
            settings[row.key] = row.value
        }
        return NextResponse.json({ settings })
    } catch (error) {
        console.error('[Admin Settings] GET error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/admin/settings — body: { key: string, value: string }
//   or batch: { settings: Record<string, string> }
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore
        })
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        let body: any
        try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

        // Support single { key, value } or batch { settings: {...} }
        let updates: Array<{ key: string; value: string }> = []

        if (body.settings && typeof body.settings === 'object') {
            updates = Object.entries(body.settings)
                .filter(([key]) => ALLOWED_KEYS.includes(key))
                .map(([key, value]) => ({ key, value: String(value) }))
        } else if (body.key && body.value !== undefined) {
            if (!ALLOWED_KEYS.includes(body.key)) {
                return NextResponse.json({ error: 'Key not permitted' }, { status: 403 })
            }
            updates = [{ key: body.key, value: String(body.value) }]
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 })
        }

        const { error } = await (supabase.from('admin_settings') as any)
            .upsert(updates, { onConflict: 'key' })

        if (error) {
            console.error('[Admin Settings] Save error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        revalidateTag(PUBLIC_CONFIG_CACHE_TAG)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Admin Settings] POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
