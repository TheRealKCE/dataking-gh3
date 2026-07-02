import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from '@/lib/classifieds-auth'
import { sendSMS } from '@/lib/sms-service'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        const userId = await verifyAuth(token)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { phone_number } = body

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

        // Get user first name for welcome message
        const { data: userData } = await supabase
            .from('users')
            .select('first_name')
            .eq('id', userId)
            .single()

        // Update user with seller status and phone number
        const { data: updateData, error } = await supabase
            .from('users')
            .update({
                is_seller: true,
                ...(phone_number && { phone_number })
            })
            .eq('id', userId)
            .select()

        if (error) {
            console.error('Error enabling seller status:', error)
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

        return NextResponse.json({ message: 'Seller status enabled successfully' }, { status: 200 })
    } catch (error: any) {
        console.error('Enable seller error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to enable seller status' },
            { status: 500 }
        )
    }
}
