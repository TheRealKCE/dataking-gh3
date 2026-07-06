import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyAdminAuth } from '@/lib/classifieds-auth'

// Admin-only. Uploads a picture for a classified category and stores its public
// URL on classified_categories.image_url. Reuses the existing public
// `classified-listing-images` bucket under a `categories/` prefix so no new
// bucket/policy setup is required.
const BUCKET = 'classified-listing-images'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const userId = await verifyAuth(token)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (!(await verifyAdminAuth(userId))) {
            return NextResponse.json({ error: 'Only admins can update categories' }, { status: 403 })
        }

        const categoryId = params.id
        const formData = await request.formData()
        const file = formData.get('image') as File | null
        if (!file) {
            return NextResponse.json({ error: 'Missing image file' }, { status: 400 })
        }

        const ext = (file.name.split('.').pop() || 'png').toLowerCase()
        const path = `categories/${categoryId}_${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { cacheControl: '3600', upsert: true })

        if (uploadError) {
            console.error('Category image upload error:', uploadError)
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
        }

        const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`

        const { error: dbError } = await supabase
            .from('classified_categories')
            .update({ image_url: imageUrl })
            .eq('id', categoryId)

        if (dbError) {
            console.error('Category image DB update error:', dbError)
            return NextResponse.json({ error: 'Failed to save image URL' }, { status: 500 })
        }

        return NextResponse.json({ success: true, image_url: imageUrl })
    } catch (error) {
        console.error('Category image POST error:', error)
        return NextResponse.json({ error: 'Failed to upload category image' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const userId = await verifyAuth(token)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (!(await verifyAdminAuth(userId))) {
            return NextResponse.json({ error: 'Only admins can update categories' }, { status: 403 })
        }

        const { error: dbError } = await supabase
            .from('classified_categories')
            .update({ image_url: null })
            .eq('id', params.id)

        if (dbError) {
            console.error('Category image clear error:', dbError)
            return NextResponse.json({ error: 'Failed to clear image' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Category image DELETE error:', error)
        return NextResponse.json({ error: 'Failed to clear category image' }, { status: 500 })
    }
}
