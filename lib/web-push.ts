import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export interface PushPayload {
    title: string
    body: string
    url?: string
    /** Collapse key. Same tag = the new notification replaces the old one in the
     *  shade (e.g. `order-<id>` for status updates). Omit to let each stack. */
    tag?: string
    /** Overrides the app icon shown on the left of the notification. */
    icon?: string
    /** Large picture expanded under the text (Android only). */
    image?: string
    /** Up to 2 buttons. Defaults to View / Dismiss. */
    actions?: { action: string; title: string }[]
    /** Keep it on screen until the user acts — for things that need a decision. */
    requireInteraction?: boolean
    /** No sound, no vibration. */
    silent?: boolean
    /** Deep-links the click straight to this in-app notification. */
    notificationId?: string
    /** How hard the push service works to wake a dozing phone. Default 'high'. */
    urgency?: 'very-low' | 'low' | 'normal' | 'high'
    /** Seconds the push service holds the message for an offline device. */
    ttl?: number
}

// The Topic header is base64url and capped at 32 chars by the push protocol —
// an unsanitised tag gets the whole send rejected with a 400.
function toTopic(tag: string | undefined) {
    if (!tag) return undefined
    const topic = tag.replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 32)
    return topic || undefined
}

// Helper to create an admin client that bypasses RLS for background tasks
function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    )
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
    const subject = process.env.VAPID_SUBJECT
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!subject || !publicKey || !privateKey) return

    webpush.setVapidDetails(subject, publicKey, privateKey)

    const supabase = getAdminSupabase()

    const { data: subscriptions, error } = await (supabase
        .from('push_subscriptions') as any)
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', userId)

    if (error || !subscriptions?.length) return

    const message = JSON.stringify({ ...payload, timestamp: Date.now() })
    const expiredIds: string[] = []

    // 'high' urgency is what gets FCM/APNs to deliver immediately instead of
    // batching the message until the phone next wakes up on its own — the
    // difference between an SMS-like buzz and one that lands twenty minutes late.
    const options = {
        TTL: payload.ttl ?? 24 * 60 * 60,
        urgency: payload.urgency ?? 'high',
        ...(toTopic(payload.tag) ? { topic: toTopic(payload.tag) } : {}),
    }

    await Promise.allSettled(
        subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    message,
                    options as any
                )
            } catch (err: any) {
                // 410 Gone = subscription expired; clean it up
                if (err?.statusCode === 410 || err?.statusCode === 404 || err?.statusCode === 401 || err?.statusCode === 403) {
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
    const supabase = getAdminSupabase()
    const { data: admins } = await (supabase.from('users') as any)
        .select('id')
        .eq('role', 'admin')
        
    if (!admins?.length) return
    
    await Promise.allSettled(admins.map((a: { id: string }) => sendPushToUser(a.id, payload)))
}
