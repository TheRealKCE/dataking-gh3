'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Search,
    MoreVertical,
    Ban,
    CheckCircle,
    Wallet,
    UserCog,
    Shield,
    ShieldAlert
} from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Wallet Credit Dialog State
    const [creditDialogUser, setCreditDialogUser] = useState<any>(null)
    const [creditAmount, setCreditAmount] = useState('')
    const [creditDescription, setCreditDescription] = useState('Admin manual credit')

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
          *,
          wallets (
            balance
          )
        `)
                .order('created_at', { ascending: false })

            if (error) throw error
            setUsers(data || [])
        } catch (error) {
            console.error('Error fetching users:', error)
            toast.error('Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    const handleStatusChange = async (userId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ status: newStatus })
                .eq('id', userId)

            if (error) throw error

            setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u))
            toast.success(`User marked as ${newStatus}`)
        } catch (error) {
            toast.error('Failed to update user status')
        }
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!confirm(`Are you sure you want to make this user ${newRole}?`)) return

        try {
            const { error } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId)

            if (error) throw error

            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
            toast.success(`User role updated to ${newRole}`)
        } catch (error) {
            toast.error('Failed to update user role')
        }
    }

    const handleManualCredit = async () => {
        if (!creditDialogUser || !creditAmount) return

        const amount = parseFloat(creditAmount)
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount')
            return
        }

        try {
            // Get wallet
            const { data: wallet } = await supabase
                .from('wallets')
                .select('id, balance, total_credited')
                .eq('user_id', creditDialogUser.id)
                .single()

            if (!wallet) throw new Error('Wallet not found')

            // Update wallet
            await supabase
                .from('wallets')
                .update({
                    balance: wallet.balance + amount,
                    total_credited: wallet.total_credited + amount
                })
                .eq('id', wallet.id)

            // Transaction log
            await supabase.from('wallet_transactions').insert({
                wallet_id: wallet.id,
                user_id: creditDialogUser.id,
                type: 'credit',
                amount: amount,
                description: creditDescription,
                source: 'admin',
                status: 'completed'
            })

            toast.success('Wallet credited successfully')
            fetchUsers() // Refresh list to show new balance
            setCreditDialogUser(null)
            setCreditAmount('')
        } catch (error) {
            console.error('Credit error:', error)
            toast.error('Failed to credit wallet')
        }
    }

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone_number?.includes(searchTerm)
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Users Management</h1>
                    <p className="text-muted-foreground">Manage user accounts and wallets</p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Wallet Balance</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No users found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{user.first_name} {user.last_name}</span>
                                                    <span className="text-xs text-muted-foreground">{user.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{user.phone_number}</TableCell>
                                            <TableCell>
                                                <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.status === 'active' ? 'completed' : 'failed'}>
                                                    {user.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-semibold text-green-600">
                                                {formatCurrency(user.wallets?.[0]?.balance || 0)}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDate(user.created_at)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>

                                                        <DropdownMenuItem onClick={() => setCreditDialogUser(user)}>
                                                            <Wallet className="w-4 h-4 mr-2" />
                                                            Credit Wallet
                                                        </DropdownMenuItem>

                                                        {user.status !== 'suspended' ? (
                                                            <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'suspended')}>
                                                                <Ban className="w-4 h-4 mr-2 text-red-500" />
                                                                Suspend Account
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'active')}>
                                                                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                                                Activate Account
                                                            </DropdownMenuItem>
                                                        )}

                                                        {user.role === 'user' ? (
                                                            <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'admin')}>
                                                                <Shield className="w-4 h-4 mr-2 text-purple-500" />
                                                                Make Admin
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'user')}>
                                                                <UserCog className="w-4 h-4 mr-2" />
                                                                Remove Admin
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Credit Wallet Dialog */}
            <Dialog open={!!creditDialogUser} onOpenChange={() => setCreditDialogUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Credit User Wallet</DialogTitle>
                        <DialogDescription>
                            Add funds manually to {creditDialogUser?.first_name} {creditDialogUser?.last_name}'s wallet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Amount (GHS)</Label>
                            <Input
                                type="number"
                                value={creditAmount}
                                onChange={(e) => setCreditAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={creditDescription}
                                onChange={(e) => setCreditDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreditDialogUser(null)}>Cancel</Button>
                        <Button onClick={handleManualCredit}>Credit Wallet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
