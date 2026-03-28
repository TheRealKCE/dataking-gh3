import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendSMS } from '@/lib/sms-service'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, amount } = body

        if (!userId || !amount || amount <= 0) {
            return NextResponse.json({ error: 'userId and amount are required' }, { status: 400 })
        }

        const supabase = createServerClient()

        const { data: user, error: userError } = await (supabase
            .from('users')
            .select('first_name, phone_number')
            .eq('id', userId)
            .single() as any)

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const u = user as any
        const message = `Hi ${u.first_name}, this is a friendly reminder of your GHS ${Number(amount).toFixed(2)} pending balance at KING FLEXY DATA LTD. Thanks!\n\nKingFlexyGh`

        const result = await sendSMS({
            recipient: u.phone_number,
            message
        })

        return NextResponse.json({ success: result.success, error: result.error })

    } catch (error: any) {
        console.error('[SMS Reminder] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
