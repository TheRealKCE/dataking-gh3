import { NextRequest, NextResponse } from 'next/server'
import { sendSMS } from '@/lib/sms-service'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const msg = searchParams.get('msg') || 'Test SMS from King Flexy'

    if (!phone) {
        return NextResponse.json({ error: 'Phone number required (?phone=...)' }, { status: 400 })
    }

    try {
        const result = await sendSMS({
            recipient: phone,
            message: msg
        })

        return NextResponse.json({
            status: 'Attempted',
            result: result,
            env_api_key_exists: !!process.env.MNOTIFY_API_KEY,
            env_sender_id: process.env.MNOTIFY_SENDER_ID
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
