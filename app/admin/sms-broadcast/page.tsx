'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, MessageSquare, Users, Search, CheckSquare, XSquare } from 'lucide-react'
import { toast } from 'sonner'

interface User {
    id: string
    first_name: string
    last_name: string
    phone_number: string
    role: string
    email: string
}

export default function AdminSMSBroadcastPage() {
    const [users, setUsers] = useState<User[]>([])
    const [filteredUsers, setFilteredUsers] = useState<User[]>([])
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [message, setMessage] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState<string>('all')

    useEffect(() => {
        fetchUsers()
    }, [])

    useEffect(() => {
        filterUsers()
    }, [users, searchQuery, roleFilter])

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, first_name, last_name, phone_number, role, email')
                .not('phone_number', 'is', null)
                .order('first_name', { ascending: true })

            if (error) throw error
            setUsers(data || [])
        } catch (error: any) {
            console.error('Error fetching users:', error)
            toast.error('Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    const filterUsers = () => {
        let filtered = [...users]

        // Apply role filter
        if (roleFilter !== 'all') {
            filtered = filtered.filter(u => u.role === roleFilter)
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(u =>
                u.first_name?.toLowerCase().includes(query) ||
                u.last_name?.toLowerCase().includes(query) ||
                u.phone_number?.includes(query) ||
                u.email?.toLowerCase().includes(query)
            )
        }

        setFilteredUsers(filtered)
    }

    const handleSelectAll = () => {
        const newSelected = new Set(selectedUsers)
        filteredUsers.forEach(u => newSelected.add(u.id))
        setSelectedUsers(newSelected)
    }

    const handleDeselectAll = () => {
        const newSelected = new Set(selectedUsers)
        filteredUsers.forEach(u => newSelected.delete(u.id))
        setSelectedUsers(newSelected)
    }

    const handleToggleUser = (userId: string) => {
        const newSelected = new Set(selectedUsers)
        if (newSelected.has(userId)) {
            newSelected.delete(userId)
        } else {
            newSelected.add(userId)
        }
        setSelectedUsers(newSelected)
    }

    const handleSendSMS = async () => {
        if (!message.trim()) {
            toast.error('Please enter a message')
            return
        }

        if (selectedUsers.size === 0) {
            toast.error('Please select at least one recipient')
            return
        }

        setSending(true)
        try {
            const response = await fetch('/api/admin/sms-broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userIds: Array.from(selectedUsers),
                    message: message.trim()
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send SMS')
            }

            toast.success(`SMS sent successfully! ${data.results.success}/${data.results.total} delivered`)

            if (data.results.failed > 0) {
                console.warn('[SMSBroadcast] Failed deliveries:', data.results.errors)
            }

            // Clear form
            setMessage('')
            setSelectedUsers(new Set())
        } catch (error: any) {
            console.error('Error sending SMS:', error)
            toast.error(error.message || 'Failed to send SMS')
        } finally {
            setSending(false)
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            case 'sub-admin': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
            default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
        }
    }

    const characterCount = message.length
    const smsCount = Math.ceil(characterCount / 160) || 1

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">SMS Broadcast</h1>
                <p className="text-muted-foreground">Send SMS alerts to your customers</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Compose SMS Card */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            Compose SMS
                        </CardTitle>
                        <CardDescription>
                            Write your message below. Keep it concise for best delivery.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="message">Message</Label>
                            <Textarea
                                id="message"
                                placeholder="Type your SMS message here..."
                                className="min-h-[150px] resize-none"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                maxLength={480}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{characterCount} / 480 characters</span>
                                <span>{smsCount} SMS{smsCount > 1 ? 's' : ''} (160 chars each)</span>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Selected Recipients:</span>
                                <span className="font-medium">{selectedUsers.size}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Est. SMS Cost:</span>
                                <span className="font-medium">{selectedUsers.size * smsCount} SMS units</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleSendSMS}
                            className="w-full"
                            disabled={sending || selectedUsers.size === 0 || !message.trim()}
                        >
                            {sending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4 mr-2" />
                            )}
                            Send SMS to {selectedUsers.size} Recipient{selectedUsers.size !== 1 ? 's' : ''}
                        </Button>
                    </CardContent>
                </Card>

                {/* Recipients Selection Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Select Recipients
                        </CardTitle>
                        <CardDescription>
                            Choose individual users or filter by role
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Filters */}
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, phone, or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="user">Users Only</SelectItem>
                                    <SelectItem value="sub-admin">Sub-Admins</SelectItem>
                                    <SelectItem value="admin">Admins</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Bulk Actions */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAll}
                                className="flex-1"
                            >
                                <CheckSquare className="w-4 h-4 mr-2" />
                                Select All ({filteredUsers.length})
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDeselectAll}
                                className="flex-1"
                            >
                                <XSquare className="w-4 h-4 mr-2" />
                                Deselect All
                            </Button>
                        </div>

                        {/* User List */}
                        <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No users found
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {filteredUsers.map((user) => (
                                        <label
                                            key={user.id}
                                            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                        >
                                            <Checkbox
                                                checked={selectedUsers.has(user.id)}
                                                onCheckedChange={() => handleToggleUser(user.id)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium truncate">
                                                        {user.first_name} {user.last_name}
                                                    </span>
                                                    <Badge className={`text-[10px] ${getRoleBadgeColor(user.role)}`}>
                                                        {user.role}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {user.phone_number}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-muted-foreground text-center">
                            Showing {filteredUsers.length} of {users.length} users with phone numbers
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
