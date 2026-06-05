'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Bell, Megaphone, Pencil, X, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { SystemAnnouncement } from '@/types/supabase'
import { revalidatePublicConfig } from './actions'

export default function AdminAnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([])
    const [loading, setLoading] = useState(true)
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [visibleOn, setVisibleOn] = useState<'main_site' | 'storefronts' | 'both'>('main_site')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editMessage, setEditMessage] = useState('')
    const [editVisibleOn, setEditVisibleOn] = useState<'main_site' | 'storefronts' | 'both'>('main_site')
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        fetchAnnouncements()
    }, [])

    const fetchAnnouncements = async () => {
        try {
            const { data, error } = await supabase
                .from('system_announcements')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setAnnouncements(data || [])
        } catch (error: any) {
            console.error('Error fetching announcements:', error)
            toast.error('Failed to load announcements')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !message) return

        setIsSubmitting(true)
        try {
            // First, if we want only ONE active announcement at a time, we could deactivate others.
            // But for now, let's allow multiple (though UI might visually prioritize latest)
            // Or typically, creating a new one makes it the active one.

            const { data, error } = await (supabase
                .from('system_announcements') as any)
                .insert({
                    title,
                    message,
                    visible_on: visibleOn,
                    is_active: true
                })
                .select()
                .single()

            if (error) throw error

            // Feature 3 Hierarchy: If storefronts involved, we might want to auto-clear shop-level notices
            if (visibleOn !== 'main_site') {
                await (supabase as any)
                    .from('shop_announcements')
                    .update({ is_active: false })
                    .eq('is_active', true)
            }

            // Revalidate public config cache so changes show up immediately for users
            const revalidateResult = await revalidatePublicConfig()
            if (revalidateResult.error) {
                console.error('Revalidation failed:', revalidateResult.error)
            }

            setAnnouncements([data, ...announcements])
            setTitle('')
            setMessage('')
            toast.success('Announcement posted successfully')
        } catch (error: any) {
            console.error('Error creating announcement:', error)
            toast.error('Failed to post announcement')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await (supabase
                .from('system_announcements') as any)
                .update({ is_active: !currentStatus })
                .eq('id', id)

            if (error) throw error

            setAnnouncements(announcements.map(a =>
                a.id === id ? { ...a, is_active: !currentStatus } : a
            ))

            // Feature 3 Hierarchy: If activating for storefronts, auto-deactivate shop ones
            const activated = !currentStatus
            const announcement = announcements.find(a => a.id === id)
            if (activated && announcement && announcement.visible_on !== 'main_site') {
                await (supabase as any)
                    .from('shop_announcements')
                    .update({ is_active: false })
                    .eq('is_active', true)
            }
            
            // Revalidate public config cache
            await revalidatePublicConfig()
            
            toast.success(`Announcement ${!currentStatus ? 'activated' : 'deactivated'}`)
        } catch (error) {
            toast.error('Failed to update status')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return

        try {
            const { error } = await (supabase
                .from('system_announcements') as any)
                .delete()
                .eq('id', id)

            if (error) throw error

            // Revalidate public config cache
            await revalidatePublicConfig()

            setAnnouncements(announcements.filter(a => a.id !== id))
            toast.success('Announcement deleted')
        } catch (error) {
            toast.error('Failed to delete announcement')
        }
    }

    // Start editing an announcement
    const handleStartEdit = (announcement: any) => {
        setEditingId(announcement.id)
        setEditTitle(announcement.title)
        setEditMessage(announcement.message)
        setEditVisibleOn(announcement.visible_on || 'main_site')
    }

    // Cancel editing
    const handleCancelEdit = () => {
        setEditingId(null)
        setEditTitle('')
        setEditMessage('')
        setEditVisibleOn('main_site')
    }

    // Save edited announcement and repost
    const handleSaveAndRepost = async () => {
        if (!editingId || !editTitle.trim() || !editMessage.trim()) return

        setIsUpdating(true)
        try {
            const { error } = await (supabase
                .from('system_announcements') as any)
                .update({
                    title: editTitle.trim(),
                    message: editMessage.trim(),
                    visible_on: editVisibleOn,
                    is_active: true,
                    created_at: new Date().toISOString() // Update timestamp for repost
                })
                .eq('id', editingId)

            if (error) throw error

            // Update local state
            setAnnouncements(announcements.map(a =>
                a.id === editingId
                    ? { ...a, title: editTitle.trim(), message: editMessage.trim(), visible_on: editVisibleOn, is_active: true, created_at: new Date().toISOString() }
                    : a
            ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))

            // Feature 3 Hierarchy: If reposting for storefronts, auto-deactivate shop ones
            if (editVisibleOn !== 'main_site') {
                await (supabase as any)
                    .from('shop_announcements')
                    .update({ is_active: false })
                    .eq('is_active', true)
            }

            // Revalidate public config cache
            await revalidatePublicConfig()

            setEditingId(null)
            setEditTitle('')
            setEditMessage('')
            setEditVisibleOn('main_site')
            toast.success('Announcement updated and reposted!')
        } catch (error) {
            console.error('Error updating announcement:', error)
            toast.error('Failed to update announcement')
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Post Message</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Create alerts for users when they sign in</p>
            </div>

            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
                {/* Create Form */}
                <Card className="h-fit">
                    <CardHeader className="pb-3 sm:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-800 dark:text-white">
                            <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            Create New Alert
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            This message will appear as a popup to all users.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <form onSubmit={handleCreateAnnouncement} className="space-y-3 sm:space-y-4">
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label htmlFor="title" className="text-sm text-gray-700 dark:text-gray-300">Title</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g. Maintanence Update"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label htmlFor="message" className="text-sm text-gray-700 dark:text-gray-300">Message</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Detail your message here..."
                                    className="min-h-[80px] sm:min-h-[100px] text-sm"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label className="text-sm text-gray-700 dark:text-gray-300">Visible On</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        type="button"
                                        variant={visibleOn === 'main_site' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setVisibleOn('main_site')}
                                        className="text-[10px] sm:text-xs h-8"
                                    >
                                        Main Site
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={visibleOn === 'storefronts' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setVisibleOn('storefronts')}
                                        className="text-[10px] sm:text-xs h-8"
                                    >
                                        Storefronts
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={visibleOn === 'both' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setVisibleOn('both')}
                                        className="text-[10px] sm:text-xs h-8"
                                    >
                                        Both
                                    </Button>
                                </div>
                            </div>
                            <Button type="submit" className="w-full text-sm" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Megaphone className="w-4 h-4 mr-2" />
                                )}
                                Post Announcement
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* History List */}
                <Card className="h-fit">
                    <CardHeader className="pb-3 sm:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-800 dark:text-white">
                            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            History
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Click edit to modify and repost an announcement
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4">
                        <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto space-y-3">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : announcements.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No announcements posted yet
                                </div>
                            ) : (
                                announcements.map((announcement) => (
                                    <div
                                        key={announcement.id}
                                        className="p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                                    >
                                        {editingId === announcement.id ? (
                                            <div className="space-y-3">
                                                <Input
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    placeholder="Title"
                                                    className="text-sm"
                                                />
                                                <Textarea
                                                    value={editMessage}
                                                    onChange={(e) => setEditMessage(e.target.value)}
                                                    placeholder="Message"
                                                    className="text-sm min-h-[60px]"
                                                />
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Targeting</Label>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        <Button
                                                            type="button"
                                                            variant={editVisibleOn === 'main_site' ? 'default' : 'outline'}
                                                            size="sm"
                                                            onClick={() => setEditVisibleOn('main_site')}
                                                            className="text-[10px] h-7 px-1"
                                                        >
                                                            Main Site
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={editVisibleOn === 'storefronts' ? 'default' : 'outline'}
                                                            size="sm"
                                                            onClick={() => setEditVisibleOn('storefronts')}
                                                            className="text-[10px] h-7 px-1"
                                                        >
                                                            Storefronts
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={editVisibleOn === 'both' ? 'default' : 'outline'}
                                                            size="sm"
                                                            onClick={() => setEditVisibleOn('both')}
                                                            className="text-[10px] h-7 px-1"
                                                        >
                                                            Both
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleCancelEdit}
                                                        disabled={isUpdating}
                                                        className="text-xs"
                                                    >
                                                        <X className="w-3 h-3 mr-1" />
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={handleSaveAndRepost}
                                                        disabled={isUpdating || !editTitle.trim() || !editMessage.trim()}
                                                        className="text-xs bg-green-600 hover:bg-green-700"
                                                    >
                                                        {isUpdating ? (
                                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="w-3 h-3 mr-1" />
                                                        )}
                                                        Repost
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm text-gray-800 dark:text-white truncate">
                                                            {announcement.title}
                                                        </h4>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                                                            {announcement.message}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
                                                            {formatDate(announcement.created_at)}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <Badge
                                                            variant={announcement.is_active ? 'default' : 'secondary'}
                                                            className="text-[10px]"
                                                        >
                                                            {announcement.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-[9px] uppercase hover:bg-transparent capitalize">
                                                            {announcement.visible_on?.replace('_', ' ') || 'Main site'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={announcement.is_active}
                                                            onCheckedChange={() => handleToggleStatus(announcement.id, announcement.is_active)}
                                                            className="scale-90"
                                                        />
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                                            {announcement.is_active ? 'On' : 'Off'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleStartEdit(announcement)}
                                                            className="h-8 px-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            <span className="ml-1 text-xs hidden sm:inline">Edit</span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(announcement.id)}
                                                            className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            <span className="ml-1 text-xs hidden sm:inline">Delete</span>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

