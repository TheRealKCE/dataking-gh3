import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { nameSchema, phoneSchema } from '@/lib/validation'

export async function PUT(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        
        // 1. Authenticate user securely from server-context
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
        
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized Configuration' }, { status: 401 })
        }
        
        const userId = authUser.id
        const body = await request.json()
        
        // 2. STRICT INPUT VALIDATION (XSS Prevention)
        const profileSchema = z.object({
            first_name: nameSchema.optional(),
            last_name: nameSchema.optional(),
            phone_number: phoneSchema.optional()
        })

        const validation = profileSchema.safeParse(body)
        if (!validation.success) {
            const errorDetails = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
            console.warn(`[Security] Input validation rejected for User: ${userId} — ${errorDetails.join(', ')}`)
            return NextResponse.json({ error: 'Invalid input', details: errorDetails }, { status: 400 })
        }

        // 3. STRICT PAYLOAD FILTERING (Mass Assignment Protection)
        // Destructure only the specifically allowed fields from validated data.
        // If an attacker sends { role: 'admin' }, it is completely ignored here.
        const { first_name, last_name, phone_number } = validation.data
        
        const updatePayload = {
            // Provide fallbacks to avoid undefined overwrites if a field was excluded during a partial update,
            // though the client should send all three if they are editing all three.
            ...(first_name !== undefined && { first_name: String(first_name).trim() }),
            ...(last_name !== undefined && { last_name: String(last_name).trim() }),
            ...(phone_number !== undefined && { phone_number: String(phone_number).trim() }),
            updated_at: new Date().toISOString()
        }
        
        // 3. Update the database securely using the authenticated user's ID.
        // We use the service role client here to bypass RLS. This ensures that when you 
        // lock down the RLS UPDATE policy on the users table (to prevent direct REST API access),
        // our secure backend will still have permission to execute the update.
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { error: updateError } = await (supabaseAdmin
                .from('users') as any)
                .update(updatePayload)
                .eq('id', userId)

        if (updateError) {
            console.error('[UpdateProfile] Database update error:', updateError)
            return NextResponse.json({ error: 'Failed to update profile details' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Profile updated securely' }, { status: 200 })

    } catch (e: any) {
        console.error('[UpdateProfile] API error:', e)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
