import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

type NotificationType = 'order_update' | 'complaint_resolved' | 'payment_success' | 'balance_updated' | 'system'

interface NotificationData {
    userId: string
    title: string
    message: string
    type: NotificationType
    actionUrl?: string
}

export async function createNotification(data: NotificationData) {
    const supabase = createServerClient()

    try {
        const { error } = await (supabase.from('notifications') as any).insert({
            user_id: data.userId,
            title: data.title,
            message: data.message,
            type: data.type,
            action_url: data.actionUrl,
            is_read: false,
        })

        if (error) {
            console.error('Failed to create notification:', error)
            return { success: false, error }
        }

        return { success: true }
    } catch (error) {
        console.error('Notification error:', error)
        return { success: false, error }
    }
}

export async function markAsRead(notificationId: string, userId: string) {
    const supabase = createServerClient()

    const { error } = await (supabase
        .from('notifications') as any)
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)

    return { success: !error, error }
}

export async function markAllAsRead(userId: string) {
    const supabase = createServerClient()

    const { error } = await (supabase
        .from('notifications') as any)
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

    return { success: !error, error }
}

export async function deleteNotification(notificationId: string, userId: string) {
    const supabase = createServerClient()

    const { error } = await (supabase
        .from('notifications') as any)
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId)

    return { success: !error, error }
}

export async function cleanupOldNotifications() {
    const supabase = createServerClient()

    // Delete read notifications older than 72 hours
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - 72)

    const { error } = await (supabase
        .from('notifications') as any)
        .delete()
        .eq('is_read', true)
        .lt('created_at', cutoffDate.toISOString())

    return { success: !error, error }
}

export async function notifyAllAdmins(data: Omit<NotificationData, 'userId'>) {
    // Use service role to bypass RLS when notifying admins
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        }
    )
    
    const { data: admins } = await (supabase.from('users') as any)
        .select('id')
        .eq('role', 'admin')
        
    if (!admins?.length) return { success: true }

    const notifications = admins.map((admin: { id: string }) => ({
        user_id: admin.id,
        title: data.title,
        message: data.message,
        type: data.type,
        action_url: data.actionUrl,
        is_read: false,
    }))

    const { error } = await (supabase.from('notifications') as any).insert(notifications)
    return { success: !error, error }
}

// Notification templates
export function orderUpdateNotification(orderRef: string, status: string): Omit<NotificationData, 'userId'> {
    const statusMessages: Record<string, string> = {
        processing: `Your order ${orderRef} is being processed.`,
        completed: `Your order ${orderRef} has been completed successfully!`,
        failed: `Your order ${orderRef} has failed. Please file a complaint for a refund.`,
    }

    return {
        title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: statusMessages[status] || `Order ${orderRef} status updated to ${status}`,
        type: 'order_update',
        actionUrl: '/dashboard/my-orders',
    }
}

export function paymentSuccessNotification(amount: number): Omit<NotificationData, 'userId'> {
    return {
        title: 'Payment Successful',
        message: `Your wallet has been credited with GHS ${amount.toFixed(2)}`,
        type: 'payment_success',
        actionUrl: '/dashboard/wallet',
    }
}

export function complaintResolvedNotification(complaintId: string, resolution: string): Omit<NotificationData, 'userId'> {
    return {
        title: 'Complaint Resolved',
        message: `Your complaint has been resolved: ${resolution}`,
        type: 'complaint_resolved',
        actionUrl: '/dashboard/complaints',
    }
}

export function balanceUpdatedNotification(amount: number, type: 'credit' | 'debit'): Omit<NotificationData, 'userId'> {
    const action = type === 'credit' ? 'credited' : 'debited'
    return {
        title: `Balance ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        message: `Your wallet has been ${action} with GHS ${amount.toFixed(2)}`,
        type: 'balance_updated',
        actionUrl: '/dashboard/wallet',
    }
}
