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
            title: 'ARHMS',
            body: 'Push is working on this device. Orders, payments and wallet alerts will arrive here.',
            url: '/dashboard/notifications',
            // Repeated tests replace each other instead of filling the shade.
            tag: 'arhms-test',
            actions: [
                { action: 'open', title: 'Open app' },
                { action: 'dismiss', title: 'Dismiss' },
            ],
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
