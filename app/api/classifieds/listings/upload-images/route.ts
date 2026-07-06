import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request: NextRequest) {
    try {
        // Get auth token from header
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.substring(7)

        // Verify user with auth token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse form data
        const formData = await request.formData()
        const listingId = formData.get('listing_id') as string
        const imageFiles = formData.getAll('images') as File[]

        if (!listingId || imageFiles.length === 0) {
            return NextResponse.json({ error: 'Missing listing_id or images' }, { status: 400 })
        }

        // Verify listing belongs to user
        const { data: listing, error: listingError } = await supabase
            .from('classified_listings')
            .select('id')
            .eq('id', listingId)
            .eq('seller_id', user.id)
            .single()

        if (listingError || !listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        // Upload images
        const uploadedImages = []
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i]
            const fileName = `${listingId}/${Date.now()}_${i}_${file.name}`

            // Upload to Supabase storage
            const { data, error: uploadError } = await supabase.storage
                .from('classified-listing-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                })

            if (uploadError) {
                console.error('Upload error:', uploadError)
                continue
            }

            // Create database record
            const { error: dbError } = await supabase
                .from('classified_listing_images')
                .insert({
                    listing_id: listingId,
                    storage_path: fileName,
                    display_order: i,
                })

            if (!dbError) {
                uploadedImages.push({
                    path: fileName,
                    order: i,
                })
            }
        }

        return NextResponse.json({
            success: true,
            images_uploaded: uploadedImages.length,
            images: uploadedImages,
        })
    } catch (error) {
        console.error('Image upload error:', error)
        return NextResponse.json(
            { error: 'Failed to upload images' },
            { status: 500 }
        )
    }
}
