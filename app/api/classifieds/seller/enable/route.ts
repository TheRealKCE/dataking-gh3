import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from '@/lib/classifieds-auth'
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

        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

        const { error } = await supabase
            .from('users')
            .update({ is_seller: true })
            .eq('id', userId)

        if (error) {
            console.error('Error enabling seller status:', error)
            throw error
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
