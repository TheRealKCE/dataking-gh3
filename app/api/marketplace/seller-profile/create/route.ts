import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { getOrCreateSellerProfile, updateSellerProfile } from '@/lib/marketplace-queries'

export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { display_name, region, city, whatsapp_number } = body

        if (!display_name || !display_name.trim()) {
            return NextResponse.json(
                { error: 'Display name is required' },
                { status: 400 }
            )
        }

        // Get or create seller profile
        let profile = await getOrCreateSellerProfile(authUser.id)

        if (!profile) {
            // If creation failed, try to create manually
            const { data, error } = await supabaseUserClient
                .from('marketplace_seller_profiles')
                .insert({
                    user_id: authUser.id,
                    display_name: display_name.trim(),
                    region: region || null,
                    city: city || null,
                    whatsapp_number: whatsapp_number || null,
                })
                .select()
                .single()

            if (error) {
                console.error('[SellerProfileCreate] Insert error:', error)
                return NextResponse.json(
                    { error: 'Failed to create seller profile' },
                    { status: 500 }
                )
            }

            profile = data
        } else {
            // Update existing profile
            profile = await updateSellerProfile(authUser.id, {
                display_name: display_name.trim(),
                region: region || null,
                city: city || null,
                whatsapp_number: whatsapp_number || null,
            })
        }

        return NextResponse.json({
            success: true,
            profile,
        })
    } catch (error) {
        console.error('[SellerProfileCreate] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
