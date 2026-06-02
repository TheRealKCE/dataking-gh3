import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendPushToUser } from '@/lib/web-push'
import { createNotification } from '@/lib/notification-service'

export async function POST(req: Request) {
    try {
        const supabase = createServerClient()
        
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        // 1. Send Push Notification to Device
        await sendPushToUser(userId, {
            title: 'Test Notification 🚀',
            body: 'If you are seeing this, push notifications are working perfectly on this device!',
            url: '/dashboard/notifications'
        })

        // 2. Save In-App Notification to Database
        await createNotification({
            userId,
            title: 'Test Notification 🚀',
            message: 'If you are seeing this, your in-app notifications are working perfectly!',
            type: 'system',
            actionUrl: '/dashboard/notifications'
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Test notification error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
