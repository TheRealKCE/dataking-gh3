'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    Loader2,
    Trash2,
    Store,
    Phone,
    Calendar,
    Mail
} from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Wallet Adjustment Dialog State
    const [adjustmentDialogUser, setAdjustmentDialogUser] = useState<any>(null)
    const [adjustmentAmount, setAdjustmentAmount] = useState('')
    const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit')
    const [adjustmentDescription, setAdjustmentDescription] = useState('Admin manual adjustment')
    const [isAdjusting, setIsAdjusting] = useState(false)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/admin/users')
            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Failed to fetch users')
            }
            const data = await response.json()
            setUsers(data || [])
        } catch (error: any) {
            console.error('Error fetching users:', error)
            toast.error(error.message || 'Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    const handleStatusChange = async (userId: string, newStatus: string) => {
        try {
            const { error } = await (supabase
                .from('users') as any)
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
            setLoading(true)
            const response = await fetch('/api/admin/users/role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update user role')

            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
            toast.success(`User role updated to ${newRole}`)
        } catch (error: any) {
            console.error('Role change error:', error)
            toast.error(error.message || 'Failed to update user role')
        } finally {
            setLoading(false)
        }
    }

    const handleManualAdjustment = async () => {
        if (!adjustmentDialogUser || !adjustmentAmount) return

        const amount = parseFloat(adjustmentAmount)
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount')
            return
        }

        setIsAdjusting(true)
        try {
            const response = await fetch('/api/admin/users/wallet/adjustment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: adjustmentDialogUser.id,
                    amount: amount,
                    type: adjustmentType,
                    description: adjustmentDescription
                })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to adjust wallet')

            toast.success(`Wallet ${adjustmentType === 'credit' ? 'credited' : 'debited'} successfully`)
            fetchUsers() // Refresh list to show new balance
            setAdjustmentDialogUser(null)
            setAdjustmentAmount('')
        } catch (error: any) {
            console.error('Adjustment error:', error)
            toast.error(error.message || `Failed to ${adjustmentType} wallet`)
        } finally {
            setIsAdjusting(false)
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('EXTREMELY IMPORTANT:\n\nThis will PERMANENTLY delete the user and their login access.\nThis action CANNOT be undone.\n\nAre you sure you want to proceed?')) return

        try {
            setLoading(true)
            const response = await fetch('/api/admin/users/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to delete user')

            setUsers(users.filter(u => u.id !== userId))
            toast.success('User permanently deleted')
        } catch (error: any) {
            console.error('Deletion error:', error)
            toast.error(error.message || 'Failed to delete user')
        } finally {
            setLoading(false)
        }
    }

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone_number?.includes(searchTerm)
    )

    return (
        <div className="space-y-6 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-0 bg-background/95 backdrop-blur z-30 py-4 border-b">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Users Management
                    </h1>
                    <p className="text-sm text-muted-foreground">Manage accounts and wallets</p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-purple-500 transition-all rounded-xl"
                    />
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <p>No users found matching your search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredUsers.map((user) => (
                        <Card
                            key={user.id}
                            className="group relative overflow-hidden border-border/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-gradient-to-br from-card to-secondary/10"
                        >
                            <CardContent className="p-5 space-y-4">
                                {/* Header / ID Card Style */}
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3 items-center">
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                            {user.first_name?.[0]}{user.last_name?.[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm line-clamp-1">{user.first_name} {user.last_name}</h3>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                {user.role === 'admin' ? (
                                                    <Badge variant="outline" className="h-5 px-1 bg-purple-500/10 text-purple-600 border-purple-200">Admin</Badge>
                                                ) : user.role === 'sub-admin' ? (
                                                    <Badge variant="outline" className="h-5 px-1 bg-blue-500/10 text-blue-600 border-blue-200">Sub-Admin</Badge>
                                                ) : (
                                                    <span className="flex items-center gap-1"><UserCog className="w-3 h-3" /> User</span>
                                                )}
                                                <span>•</span>
                                                <span className={user.status === 'active' ? 'text-green-600' : 'text-red-500'}>
                                                    {user.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => {
                                                setAdjustmentDialogUser(user)
                                                setAdjustmentType('credit')
                                                setAdjustmentDescription('Admin manual credit')
                                            }}>
                                                <Wallet className="w-4 h-4 mr-2" />
                                                Credit Wallet
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                                setAdjustmentDialogUser(user)
                                                setAdjustmentType('debit')
                                                setAdjustmentDescription('Admin manual debit')
                                            }}>
                                                <Wallet className="w-4 h-4 mr-2 text-red-500" />
                                                Debit Wallet
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
                                                <>
                                                    <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'admin')}>
                                                        <Shield className="w-4 h-4 mr-2 text-purple-500" />
                                                        Make Admin
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'sub-admin')}>
                                                        <Shield className="w-4 h-4 mr-2 text-blue-500" />
                                                        Make Sub-Admin
                                                    </DropdownMenuItem>
                                                </>
                                            ) : user.role === 'sub-admin' ? (
                                                <>
                                                    <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'admin')}>
                                                        <Shield className="w-4 h-4 mr-2 text-purple-500" />
                                                        Promote to Admin
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'user')}>
                                                        <UserCog className="w-4 h-4 mr-2" />
                                                        Remove Admin Access
                                                    </DropdownMenuItem>
                                                </>
                                            ) : (
                                                <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'user')}>
                                                    <UserCog className="w-4 h-4 mr-2" />
                                                    Remove Admin
                                                </DropdownMenuItem>
                                            )}

                                            <div className="h-px bg-border my-1" />

                                            <DropdownMenuItem
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete User
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Details Grid */}
                                <div className="grid gap-2 text-sm mt-2">
                                    <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-lg bg-secondary/30">
                                        <Mail className="w-4 h-4 shrink-0" />
                                        <span className="truncate text-xs">{user.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-lg bg-secondary/30">
                                        <Phone className="w-4 h-4 shrink-0" />
                                        <span className="text-xs">{user.phone_number || 'No phone'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-lg bg-secondary/30">
                                        <Calendar className="w-4 h-4 shrink-0" />
                                        <span className="text-xs">Joined {formatDate(user.created_at)}</span>
                                    </div>
                                </div>

                                {/* Wallet Section */}
                                <div className="mt-4 pt-4 border-t border-dashed flex justify-between items-center bg-card/50 -mx-5 -mb-5 px-5 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Wallet Balance</span>
                                        <span className="font-bold text-lg text-green-600 font-mono">
                                            {formatCurrency((Array.isArray(user.wallets) ? user.wallets[0]?.balance : user.wallets?.balance) || 0)}
                                        </span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 rounded-full text-xs shadow-sm"
                                        onClick={() => {
                                            setAdjustmentDialogUser(user)
                                            setAdjustmentType('credit')
                                            setAdjustmentDescription('Admin manual credit')
                                        }}
                                    >
                                        <Wallet className="w-3 h-3 mr-1.5" />
                                        Top up
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Wallet Adjustment Dialog */}
            <Dialog open={!!adjustmentDialogUser} onOpenChange={() => setAdjustmentDialogUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{adjustmentType === 'credit' ? 'Credit' : 'Debit'} User Wallet</DialogTitle>
                        <DialogDescription>
                            {adjustmentType === 'credit' ? 'Add funds to' : 'Deduct funds from'} {adjustmentDialogUser?.first_name} {adjustmentDialogUser?.last_name}'s wallet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Adjustment Type</Label>
                            <Select
                                value={adjustmentType}
                                onValueChange={(value: 'credit' | 'debit') => setAdjustmentType(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="credit">Credit (+)</SelectItem>
                                    <SelectItem value="debit">Debit (-)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Amount (GHS)</Label>
                            <Input
                                type="number"
                                value={adjustmentAmount}
                                onChange={(e) => setAdjustmentAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={adjustmentDescription}
                                onChange={(e) => setAdjustmentDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdjustmentDialogUser(null)}>Cancel</Button>
                        <Button
                            variant={adjustmentType === 'debit' ? 'destructive' : 'default'}
                            onClick={handleManualAdjustment}
                            disabled={isAdjusting}
                        >
                            {isAdjusting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {adjustmentType === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
