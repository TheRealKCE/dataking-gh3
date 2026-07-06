import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { createMarketplaceOrder } from '@/lib/marketplace-queries'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            title,
            description,
            category_id,
            condition,
            price_pesewas,
            location,
            region,
            city,
            images,
            variants,
            allowed_payment_modes,
        } = body

        // Validate required fields
        if (!title || !category_id || !price_pesewas) {
            return NextResponse.json(
                { error: 'Missing required fields: title, category_id, price_pesewas' },
                { status: 400 }
            )
        }

        // Create listing in classified_listings (use existing table)
        const { data: listing, error: listingError } = await supabaseUserClient
            .from('classified_listings')
            .insert({
                title: title.trim(),
                description: description?.trim() || '',
                category_id,
                condition: condition || 'used',
                price_pesewas: parseInt(price_pesewas),
                location: location || '',
                region,
                city,
                seller_id: authUser.id,
                status: 'active',
            })
            .select()
            .single()

        if (listingError) {
            console.error('[ListingCreate] Insert error:', listingError)
            return NextResponse.json(
                { error: 'Failed to create listing' },
                { status: 500 }
            )
        }

        // Upload images if provided
        const imageUrls = []
        if (images && Array.isArray(images)) {
            for (let i = 0; i < images.length; i++) {
                const image = images[i]
                const filename = `${authUser.id}/${listing.id}/${uuidv4()}.webp`

                // If image is base64, decode and upload
                if (image.base64) {
                    const buffer = Buffer.from(image.base64, 'base64')
                    const { error: uploadError } = await supabaseUserClient.storage
                        .from('classifieds-images')
                        .upload(filename, buffer, {
                            contentType: 'image/webp',
                            upsert: false,
                        })

                    if (!uploadError) {
                        imageUrls.push(filename)
                    }
                }
            }
        }

        // Save images to database
        if (imageUrls.length > 0) {
            await supabaseUserClient
                .from('classified_listing_images')
                .insert(
                    imageUrls.map((url, i) => ({
                        listing_id: listing.id,
                        image_url: url,
                        sort_order: i,
                    }))
                )
        }

        // Create variants if provided
        if (variants && Array.isArray(variants)) {
            await supabaseUserClient
                .from('marketplace_listing_variants')
                .insert(
                    variants.map((v: any) => ({
                        listing_id: listing.id,
                        option1_name: v.option1_name,
                        option1_value: v.option1_value,
                        option2_name: v.option2_name,
                        option2_value: v.option2_value,
                        price_delta_pesewas: v.price_delta_pesewas || 0,
                        quantity: v.quantity,
                    }))
                )
        }

        return NextResponse.json({
            success: true,
            listing: {
                ...listing,
                images: imageUrls.length,
                variants: variants?.length || 0,
            },
        })
    } catch (error) {
        console.error('[ListingCreate] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
