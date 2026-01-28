'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Bell,
    CheckCircle2,
    ShoppingCart,
    CreditCard,
    MessageSquare,
    Wallet,
    Trash2,
    Check,
    AlertCircle,
    Loader2,
    Trash
} from 'lucide-react'
import { toast } from 'sonner'
import { Notification } from '@/types/supabase'

export default function NotificationsPage() {
    const { dbUser } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [markingAllRead, setMarkingAllRead] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)

    useEffect(() => {
        if (dbUser) {
            fetchNotifications()
        }
    }, [dbUser])

    const fetchNotifications = async () => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .order('created_at', { ascending: false })

            if (error) throw error
            setNotifications(data || [])
        } catch (error) {
            console.error('Error fetching notifications:', error)
            toast.error('Failed to load notifications')
        } finally {
            setIsLoading(false)
        }
    }

    const markAsRead = async (id: string) => {
        try {
            await (supabase
                .from('notifications') as any)
                .update({ is_read: true })
                .eq('id', id)

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            )
        } catch (error) {
            toast.error('Failed to mark as read')
        }
    }

    const markAllAsRead = async () => {
        setMarkingAllRead(true)
        try {
            await (supabase
                .from('notifications') as any)
                .update({ is_read: true })
                .eq('user_id', dbUser?.id as any)
                .eq('is_read', false)

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            toast.success('All notifications marked as read')
        } catch (error) {
            toast.error('Failed to mark all as read')
        } finally {
            setMarkingAllRead(false)
        }
    }

    const deleteNotification = async (id: string) => {
        try {
            await (supabase
                .from('notifications') as any)
                .delete()
                .eq('id', id)

            setNotifications(prev => prev.filter(n => n.id !== id))
            toast.success('Notification deleted')
        } catch (error) {
            toast.error('Failed to delete notification')
        }
    }

    const deleteAllNotifications = async () => {
        setDeletingAll(true)
        try {
            await (supabase
                .from('notifications') as any)
                .delete()
                .eq('user_id', dbUser?.id as any)

            setNotifications([])
            toast.success('All notifications deleted')
        } catch (error) {
            toast.error('Failed to delete all notifications')
        } finally {
            setDeletingAll(false)
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'order_update':
                return <ShoppingCart className="w-5 h-5 text-blue-500" />
            case 'payment_success':
                return <CreditCard className="w-5 h-5 text-green-500" />
            case 'complaint_resolved':
                return <MessageSquare className="w-5 h-5 text-purple-500" />
            case 'balance_updated':
                return <Wallet className="w-5 h-5 text-amber-500" />
            default:
                return <Bell className="w-5 h-5 text-gray-500" />
        }
    }

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications

    const unreadCount = notifications.filter(n => !n.is_read).length

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Notifications</h1>
                    <p className="text-muted-foreground">
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {unreadCount > 0 && (
                        <Button variant="outline" onClick={markAllAsRead} disabled={markingAllRead}>
                            {markingAllRead ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            Mark all as read
                        </Button>
                    )}
                    {notifications.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={deleteAllNotifications}
                            disabled={deletingAll}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                            {deletingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash className="w-4 h-4 mr-2" />}
                            Delete All
                        </Button>
                    )}
                </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2">
                <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                >
                    All ({notifications.length})
                </Button>
                <Button
                    variant={filter === 'unread' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('unread')}
                >
                    Unread ({unreadCount})
                </Button>
            </div>

            {/* Notifications List */}
            {filteredNotifications.length === 0 ? (
                <Card className="p-12 text-center">
                    <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                        {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                    </p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredNotifications.map((notification) => (
                        <Card
                            key={notification.id}
                            className={`transition-all ${!notification.is_read
                                ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-blue-500'
                                : ''
                                }`}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!notification.is_read ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted'
                                        }`}>
                                        {getIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className={`font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {notification.title}
                                                </h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {formatDate(notification.created_at)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {!notification.is_read && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => markAsRead(notification.id)}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => deleteNotification(notification.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
