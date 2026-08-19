import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { revalidateTag } from 'next/cache'
import { PUBLIC_CONFIG_CACHE_TAG } from '@/lib/cache-tags'
import { UTILITY_SERVICE_KEYS } from '@/lib/hubtel-utility-service'

/**
 * Every admin_settings key the utilities feature owns.
 *
 * Built from the service registry rather than typed out, so adding a sixth utility
 * to lib/hubtel-utility-service.ts brings its settings along automatically instead
 * of silently going unconfigurable.
 */
const UTILITY_SETTING_KEYS: string[] = [
    'utility_auto_fulfillment_enabled',
    'utility_public_launch',
    'page_access_utilities',
    ...UTILITY_SERVICE_KEYS.flatMap(service => [
        `utility_enabled_${service}`,
        `utility_auto_${service}`,
        `utility_fee_${service}_customer`,
        `utility_fee_${service}_agent`,
        `utility_min_amount_${service}`,
        `utility_max_amount_${service}`,
    ]),
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

export async function GET() {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        const { data, error } = await (supabase.from('admin_settings') as any)
            .select('key, value')
            .in('key', UTILITY_SETTING_KEYS)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const settings: Record<string, string> = {}
        for (const row of (data || [])) settings[row.key] = row.value

        return NextResponse.json({ settings })
    } catch (error) {
        console.error('[Admin Utility Settings] GET error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let body: any
        try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

        const updates = Object.entries(body)
            .filter(([key]) => UTILITY_SETTING_KEYS.includes(key))
            .map(([key, value]) => ({ key, value: String(value) }))

        if (updates.length === 0) return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 })

        const supabase = createServerClient()
        const { error } = await (supabase.from('admin_settings') as any)
            .upsert(updates, { onConflict: 'key' })

        if (error) {
            console.error('[Admin Utility Settings] Save error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        revalidateTag(PUBLIC_CONFIG_CACHE_TAG)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Admin Utility Settings] POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
