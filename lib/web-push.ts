import webpush from 'web-push'
import { createServerClient } from '@/lib/supabase'

interface PushPayload {
    title: string
    body: string
    url?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
    const subject = process.env.VAPID_SUBJECT
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!subject || !publicKey || !privateKey) return

    webpush.setVapidDetails(subject, publicKey, privateKey)

    const supabase = createServerClient()

    const { data: subscriptions, error } = await (supabase
        .from('push_subscriptions') as any)
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', userId)

    if (error || !subscriptions?.length) return

    const message = JSON.stringify(payload)
    const expiredIds: string[] = []

    await Promise.allSettled(
        subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    message
                )
            } catch (err: any) {
                // 410 Gone = subscription expired; clean it up
                if (err?.statusCode === 410 || err?.statusCode === 404 || err?.statusCode === 401) {
                    expiredIds.push(sub.id)
                }
            }
        })
    )

    if (expiredIds.length) {
        await (supabase.from('push_subscriptions') as any)
            .delete()
            .in('id', expiredIds)
    }
}

export async function sendPushToAdmins(payload: PushPayload) {
    const supabase = createServerClient()
    const { data: admins } = await (supabase.from('users') as any)
        .select('id')
        .eq('role', 'admin')
    if (!admins?.length) return
    await Promise.allSettled(admins.map((a: { id: string }) => sendPushToUser(a.id, payload)))
}
