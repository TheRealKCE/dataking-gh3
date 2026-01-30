'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/types/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Loader2, Search, CheckCircle, XCircle, Clock, Mail, Phone, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface PendingUser extends User {
    _count?: number
}

export default function PendingUsersPage() {
    const [users, setUsers] = useState<PendingUser[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    useEffect(() => {
        fetchPendingUsers()
    }, [])

    const fetchPendingUsers = async () => {
        try {
            const { data, error } = await (supabase
                .from('users') as any)
                .select('*')
                .eq('account_status', 'pending')
                .order('created_at', { ascending: false })

            if (error) throw error
            setUsers(data || [])
        } catch (error) {
            console.error('Error fetching pending users:', error)
            toast.error('Failed to load pending users')
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (userId: string) => {
        setActionLoading(userId)
        try {
            const response = await fetch('/api/admin/users/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })

            if (!response.ok) throw new Error('Failed to approve user')

            toast.success('User approved successfully')
            // Remove from list
            setUsers(users.filter(u => u.id !== userId))
        } catch (error) {
            console.error('Error approving user:', error)
            toast.error('Failed to approve user')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (userId: string) => {
        setActionLoading(userId)
        try {
            const response = await fetch('/api/admin/users/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })

            if (!response.ok) throw new Error('Failed to reject user')

            toast.success('User rejected')
            // Remove from list
            setUsers(users.filter(u => u.id !== userId))
        } catch (error) {
            console.error('Error rejecting user:', error)
            toast.error('Failed to reject user')
        } finally {
            setActionLoading(null)
        }
    }

    const filteredUsers = users.filter(user =>
        user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone_number?.includes(searchQuery)
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Pending User Approvals</h1>
                <p className="text-muted-foreground">Review and approve new user registrations</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Pending Registrations</CardTitle>
                            <CardDescription>
                                {users.length} user{users.length !== 1 ? 's' : ''} awaiting approval
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-lg px-4 py-2">
                            <Clock className="w-4 h-4 mr-2" />
                            {users.length}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Search */}
                    <div className="mb-4 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            placeholder="Search by name, email, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-12">
                            <UserIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Pending Users</h3>
                            <p className="text-muted-foreground">
                                {searchQuery ? 'No users match your search' : 'All caught up! No pending approvals.'}
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Registered</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">
                                                        {user.first_name} {user.last_name}
                                                    </p>
                                                    <Badge variant="outline" className="mt-1 text-xs">
                                                        {user.role}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-3 h-3 text-muted-foreground" />
                                                        <span className="text-muted-foreground">{user.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-3 h-3 text-muted-foreground" />
                                                        <span className="text-muted-foreground">{user.phone_number}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                                        onClick={() => {
                                                            if (confirm(`Approve ${user.first_name} ${user.last_name}?\n\nThey will receive an email and be able to login.`)) {
                                                                handleApprove(user.id)
                                                            }
                                                        }}
                                                        disabled={actionLoading === user.id}
                                                    >
                                                        {actionLoading === user.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle className="w-4 h-4 mr-1" />
                                                        )}
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                        onClick={() => {
                                                            if (confirm(`Reject ${user.first_name} ${user.last_name}?\n\nThey will receive a rejection email.`)) {
                                                                handleReject(user.id)
                                                            }
                                                        }}
                                                        disabled={actionLoading === user.id}
                                                    >
                                                        <XCircle className="w-4 h-4 mr-1" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
