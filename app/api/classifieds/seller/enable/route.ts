import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from '@/lib/classifieds-auth'
import { sendSMS } from '@/lib/sms-service'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
    try {
        console.log('[SellerEnable] Request started')
        console.log('[SellerEnable] Service key available:', !!supabaseServiceKey)

        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        const userId = await verifyAuth(token)
        if (!userId) {
            console.log('[SellerEnable] Auth failed - no user ID')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[SellerEnable] User authenticated:', userId)

        const body = await request.json()
        const { phone_number } = body

        console.log('[SellerEnable] Request body:', { phone_number: phone_number ? '***' : 'none' })

        // Validate phone number if provided
        if (phone_number) {
            const validation = validateGhanaianPhone(phone_number)
            if (!validation.isValid) {
                console.log('[SellerEnable] Phone validation failed:', validation.error)
                return NextResponse.json(
                    { error: validation.error || 'Invalid phone number format' },
                    { status: 400 }
                )
            }
            console.log('[SellerEnable] Phone number valid')
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

        // Get user first name for welcome message
        console.log('[SellerEnable] Fetching user data...')
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('first_name')
            .eq('id', userId)
            .single()

        if (userError) {
            console.error('[SellerEnable] Error fetching user:', userError)
        } else {
            console.log('[SellerEnable] User data retrieved:', userData?.first_name)
        }

        // Update user with seller status and phone number
        console.log('[SellerEnable] Updating user record...')
        const { data: updateData, error } = await supabase
            .from('users')
            .update({
                is_seller: true,
                ...(phone_number && { phone_number })
            })
            .eq('id', userId)
            .select()

        if (error) {
            console.error('[SellerEnable] Update error:', error.message, error.code, error.details)
            throw error
        }

        console.log('[SellerEnable] Update successful for user:', userId, 'is_seller:', updateData?.[0]?.is_seller)

        // Send welcome SMS
        if (phone_number) {
            const firstName = userData?.first_name || 'Seller'
            const welcomeMessage = `Welcome ${firstName}! 🎉 You are now a seller on ARHMS MARKETPLACE. Start posting items to reach buyers. Visit: arhmsgh.com`

            const smsResult = await sendSMS({
                recipient: phone_number,
                message: welcomeMessage,
            })

            if (!smsResult.success) {
                console.warn('[SellerEnable] SMS failed but seller status was enabled:', smsResult.error)
            } else {
                console.log('[SellerEnable] SMS sent successfully')
            }
        }

        console.log('[SellerEnable] Success - returning 200')
        return NextResponse.json({ message: 'Seller status enabled successfully' }, { status: 200 })
    } catch (error: any) {
        console.error('[SellerEnable] Exception caught:', error.message)
        console.error('[SellerEnable] Full error:', JSON.stringify(error, null, 2))
        return NextResponse.json(
            { error: error.message || 'Failed to enable seller status' },
            { status: 500 }
        )
    }
}
