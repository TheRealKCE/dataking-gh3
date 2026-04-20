import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'
import {
    shortTextSchema,
    longTextSchema,
    phoneSchema,
    emailSchema,
    slugSchema,
    whatsappSchema,
    urlSchema,
    colorSchema,
} from '@/lib/validation'

// ─── Validation Schema ────────────────────────────────────────────────────────
// Every field a shop owner is allowed to write. Protected fields (owner_id,
// is_active, approval_status) are intentionally absent — they cannot be set here.
const shopProfileSchema = z.object({
    shop_name:       shortTextSchema,
    shop_slug:       slugSchema,
    description:     longTextSchema.optional(),
    owner_phone:     phoneSchema,
    owner_email:     emailSchema.optional().nullable(),
    whatsapp_number: whatsappSchema.optional().nullable(),
    community_link:  urlSchema.optional().nullable(),
    brand_color:     colorSchema.optional(),
    brand_accent:    colorSchema.optional(),
    logo_url:        urlSchema.optional().nullable(),
    banner_url:      urlSchema.optional().nullable(),
    banner_pos_x:    z.number().min(0).max(100).optional(),
    banner_pos_y:    z.number().min(0).max(100).optional(),
    banner_zoom:     z.number().min(1).max(2.5).optional(),
    divider_style:   shortTextSchema.optional(),
})

// Helper: convert empty strings to null for optional text fields
function emptyToNull(val: string | undefined | null): string | null {
    if (val === undefined || val === null || val.trim() === '') return null
    return val.trim()
}

// ─── POST — Create shop ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    return handleShopProfileWrite(request, 'create')
}

// ─── PUT — Update shop ────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
    return handleShopProfileWrite(request, 'update')
}

// ─── Shared handler ───────────────────────────────────────────────────────────
async function handleShopProfileWrite(request: NextRequest, mode: 'create' | 'update') {
    try {
        // 1. Authenticate
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore,
        })

        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id
        const body = await request.json()

        // 2. Strict input validation (XSS / format prevention)
        const validation = shopProfileSchema.safeParse(body)
        if (!validation.success) {
            const errorDetails = validation.error.errors.map(
                err => `${err.path.join('.')}: ${err.message}`
            )
            console.warn(`[Security] Shop profile input rejected for user ${userId}: ${errorDetails.join(', ')}`)
            return NextResponse.json({ error: 'Invalid input', details: errorDetails }, { status: 400 })
        }

        // 3. Mass-assignment protection — explicitly destructure only allowed fields
        const data = validation.data as {
            shop_name: string
            shop_slug: string
            description?: string
            owner_phone: string
            owner_email?: string | null
            whatsapp_number?: string | null
            community_link?: string | null
            brand_color?: string
            brand_accent?: string
            logo_url?: string | null
            banner_url?: string | null
            banner_pos_x?: number
            banner_pos_y?: number
            banner_zoom?: number
            divider_style?: string
        }

        // Build safe DB payload — empty optional strings become null
        const dbPayload = {
            shop_name:       data.shop_name.trim(),
            shop_slug:       data.shop_slug.trim(),
            description:     emptyToNull(data.description),
            owner_phone:     data.owner_phone.trim(),
            owner_email:     emptyToNull(data.owner_email),
            whatsapp_number: emptyToNull(data.whatsapp_number),
            community_link:  emptyToNull(data.community_link),
            brand_color:     data.brand_color?.trim() || undefined,
            brand_accent:    data.brand_accent?.trim() || undefined,
            logo_url:        data.logo_url === undefined ? undefined : (data.logo_url ? data.logo_url.trim() : null),
            banner_url:      data.banner_url === undefined ? undefined : (data.banner_url ? data.banner_url.trim() : null),
            banner_pos_x:    data.banner_pos_x,
            banner_pos_y:    data.banner_pos_y,
            banner_zoom:     data.banner_zoom,
            divider_style:   data.divider_style?.trim() || undefined,
            updated_at:      new Date().toISOString(),
        }

        // 4. Use service role to bypass RLS (same pattern as update-profile)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        if (mode === 'create') {
            // Check the user doesn't already have a shop (idempotency guard)
            const { data: existing } = await (supabaseAdmin as any)
                .from('shop_profiles')
                .select('id')
                .eq('owner_id', userId)
                .maybeSingle()

            if (existing) {
                return NextResponse.json(
                    { error: 'You already have a shop. Use PUT to update it.' },
                    { status: 409 }
                )
            }

            const { error: insertError } = await (supabaseAdmin as any)
                .from('shop_profiles')
                .insert({ ...dbPayload, owner_id: userId, approval_status: 'approved', is_active: false })

            if (insertError) {
                console.error('[ShopProfile] Insert error:', insertError)
                // Expose slug conflict specifically for UI feedback
                if (insertError.code === '23505') {
                    return NextResponse.json(
                        { error: 'Invalid input', details: ['shop_slug: This slug is already taken'] },
                        { status: 409 }
                    )
                }
                return NextResponse.json({ error: 'Failed to create shop' }, { status: 500 })
            }
        } else {
            // Verify shop belongs to this authenticated user before updating
            const { data: existing } = await (supabaseAdmin as any)
                .from('shop_profiles')
                .select('id')
                .eq('owner_id', userId)
                .maybeSingle()

            if (!existing) {
                return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
            }

            const { error: updateError } = await (supabaseAdmin as any)
                .from('shop_profiles')
                .update(dbPayload)
                .eq('owner_id', userId)

            if (updateError) {
                console.error('[ShopProfile] Update error:', updateError)
                if (updateError.code === '23505') {
                    return NextResponse.json(
                        { error: 'Invalid input', details: ['shop_slug: This slug is already taken'] },
                        { status: 409 }
                    )
                }
                return NextResponse.json({ error: 'Failed to update shop' }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true }, { status: 200 })

    } catch (e: any) {
        console.error('[ShopProfile] API error:', e)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
