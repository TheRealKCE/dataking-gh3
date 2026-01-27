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
import { Loader2, Plus, Trash2, Bell, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { SystemAnnouncement } from '@/types/supabase'

export default function AdminAnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([])
    const [loading, setLoading] = useState(true)
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

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

            const { data, error } = await supabase
                .from('system_announcements')
                .insert({
                    title,
                    message,
                    is_active: true
                } as any)
                .select()
                .single()

            if (error) throw error

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
            const { error } = await supabase
                .from('system_announcements')
                .update({ is_active: !currentStatus } as any)
                .eq('id', id)

            if (error) throw error

            setAnnouncements(announcements.map(a =>
                a.id === id ? { ...a, is_active: !currentStatus } : a
            ))
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

            setAnnouncements(announcements.filter(a => a.id !== id))
            toast.success('Announcement deleted')
        } catch (error) {
            toast.error('Failed to delete announcement')
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Post Message</h1>
                <p className="text-muted-foreground">Create alerts for users when they sign in</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Create Form */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Create New Alert
                        </CardTitle>
                        <CardDescription>
                            This message will appear as a popup to all users.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g. Maintanence Update"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Detail your message here..."
                                    className="min-h-[100px]"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
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
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-primary" />
                            History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[500px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Announcement</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : announcements.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                No announcements posted yet
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        announcements.map((announcement) => (
                                            <TableRow key={announcement.id}>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-medium">{announcement.title}</span>
                                                        <span className="text-xs text-muted-foreground line-clamp-1">
                                                            {announcement.message}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {formatDate(announcement.created_at)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={announcement.is_active}
                                                            onCheckedChange={() => handleToggleStatus(announcement.id, announcement.is_active)}
                                                        />
                                                        <Badge variant={announcement.is_active ? 'default' : 'secondary'}>
                                                            {announcement.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(announcement.id)}
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
