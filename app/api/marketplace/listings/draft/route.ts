import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { draft_id, draft_data } = body

        if (!draft_data) {
            return NextResponse.json({ error: 'draft_data is required' }, { status: 400 })
        }

        // Use draft_id if provided (update), otherwise create new
        const draftListingId = draft_id || `draft-${authUser.id}-${Date.now()}`

        // Save to database (use a dedicated drafts table or store in listings with status='draft')
        const { data, error } = await supabaseUserClient
            .from('classified_listings')
            .upsert(
                {
                    id: draft_id || undefined,
                    seller_id: authUser.id,
                    title: draft_data.title || '',
                    description: draft_data.description || '',
                    category_id: draft_data.category_id || null,
                    status: 'draft',
                    price_pesewas: draft_data.price_pesewas || 0,
                    region: draft_data.region || null,
                    city: draft_data.city || null,
                },
                { onConflict: 'id' }
            )
            .select()
            .single()

        if (error) {
            console.error('[DraftSave] Error:', error)
            return NextResponse.json(
                { error: 'Failed to save draft' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            draft_id: data.id,
        })
    } catch (error) {
        console.error('[DraftSave] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch user's draft listings
        const { data, error } = await supabaseUserClient
            .from('classified_listings')
            .select('*')
            .eq('seller_id', authUser.id)
            .eq('status', 'draft')
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('[DraftFetch] Error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch drafts' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            drafts: data || [],
        })
    } catch (error) {
        console.error('[DraftFetch] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
